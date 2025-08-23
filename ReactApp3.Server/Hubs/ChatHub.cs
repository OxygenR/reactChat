using Microsoft.AspNetCore.SignalR;
using ReactApp3.Server.Models;
using ReactApp3.Server.DbContext;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;

namespace ReactApp3.Server.Hubs
{
    public class ChatHub : Hub
    {
        private readonly DatabaseContext _context;
        private readonly IConfiguration _configuration;
        private static Dictionary<string, int> _connectedUsers = new Dictionary<string, int>();

        public ChatHub(IConfiguration configuration)
        {
            _configuration = configuration;
            var conn = configuration.GetConnectionString("DefaultConnection");
            _context = new DatabaseContext(conn);
        }

        public override async Task OnConnectedAsync()
        {
            // Создаем тестовых пользователей при первом подключении
            await _context.CreateTestUsersAsync();

            // Здесь можно получить Windows username из контекста
            var windowsUsername = Context.User?.Identity?.Name ?? "testuser1"; // Заглушка для теста

            var user = await _context.GetUserByWindowsUsernameAsync(windowsUsername);
            if (user != null)
            {
                _connectedUsers[Context.ConnectionId] = user.UserId;
                await _context.UpdateUserStatusAsync(user.UserId, true);

                // Уведомляем всех об изменении статуса
                await Clients.All.SendAsync("UserStatusChanged", user.UserId, true);
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var userId))
            {
                await _context.UpdateUserStatusAsync(userId, false);
                _connectedUsers.Remove(Context.ConnectionId);

                // Уведомляем всех об изменении статуса
                await Clients.All.SendAsync("UserStatusChanged", userId, false);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(int receiverId, string message)
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var senderId))
            {
                // Сохранение сообщения в базе данных и получение его ID
                var messageId = await _context.AddMessageAsync(senderId, receiverId, message);

                // Получаем данные отправителя и получателя
                var sender = await _context.GetUserByIdAsync(senderId);
                var receiver = await _context.GetUserByIdAsync(receiverId);

                // Получаем сохраненное сообщение из базы с правильным ID
                var savedMessage = await _context.GetMessageByIdAsync(messageId);

                // Отправка сообщения отправителю и получателю
                await Clients.Caller.SendAsync("ReceiveMessage", new
                {
                    MessageId = savedMessage.MessageId, // ← Используем ID из базы!
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    MessageText = message,
                    Timestamp = savedMessage.Timestamp,
                    Sender = sender,
                    Receiver = receiver
                });

                await Clients.User(receiverId.ToString()).SendAsync("ReceiveMessage", new
                {
                    MessageId = savedMessage.MessageId, // ← Используем ID из базы!
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    MessageText = message,
                    Timestamp = savedMessage.Timestamp,
                    Sender = sender,
                    Receiver = receiver
                });
            }
        }

        public async Task EditMessage(int messageId, string newMessageText)
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var userId))
            {
                Console.WriteLine($"✏️ EditMessage called: messageId={messageId}, newText={newMessageText}, userId={userId}");

                // Проверяем, принадлежит ли сообщение пользователю
                var message = await _context.GetMessageByIdAsync(messageId);
                if (message == null)
                {
                    Console.WriteLine("❌ Message not found");
                    throw new HubException("Сообщение не найдено");
                }

                if (message.SenderId != userId)
                {
                    Console.WriteLine("❌ User not authorized to edit this message");
                    throw new HubException("Вы можете редактировать только свои сообщения");
                }

                // ✅ ОБНОВЛЯЕМ существующее сообщение, а не создаем новое
                var success = await _context.UpdateMessageAsync(messageId, newMessageText);

                if (!success)
                {
                    Console.WriteLine("❌ Failed to update message in database");
                    throw new HubException("Не удалось обновить сообщение");
                }

                // Получаем обновленное сообщение из БД
                var updatedMessage = await _context.GetMessageByIdAsync(messageId);
                var sender = await _context.GetUserByIdAsync(updatedMessage.SenderId);
                var receiver = await _context.GetUserByIdAsync(updatedMessage.ReceiverId);

                // Отправляем обновленное сообщение обоим пользователям
                var editedMessage = new
                {
                    MessageId = updatedMessage.MessageId, // ← Тот же ID!
                    SenderId = updatedMessage.SenderId,
                    ReceiverId = updatedMessage.ReceiverId,
                    MessageText = updatedMessage.MessageText,
                    Timestamp = updatedMessage.Timestamp, // ← Старая дата отправки
                    EditedTimestamp = DateTime.Now,       // ← Новая дата редактирования
                    Sender = sender,
                    Receiver = receiver,
                    IsEdited = true
                };

                Console.WriteLine($"📤 Sending MessageEdited to caller: {Context.ConnectionId}");
                await Clients.Caller.SendAsync("MessageEdited", editedMessage);

                Console.WriteLine($"📤 Sending MessageEdited to receiver: {receiver.UserId}");
                await Clients.User(receiver.UserId.ToString()).SendAsync("MessageEdited", editedMessage);

                Console.WriteLine("✅ MessageEdited events sent successfully");
            }
        }

        // Добавьте метод в ChatHub
        public async Task SendFileMessage(int receiverId, int fileId, string message = "")
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var senderId))
            {
                // Получаем информацию о файле
                var file = await _context.GetFileByIdAsync(fileId);
                if (file == null)
                {
                    throw new HubException("Файл не найден");
                }

                string messageText = string.IsNullOrEmpty(message)
                    ? $"📎 Файл: {file.OriginalName}"
                    : $"{message}\n📎 Файл: {file.OriginalName}";

                await _context.AddMessageAsync(senderId, receiverId, messageText);

                var sender = await _context.GetUserByIdAsync(senderId);
                var receiver = await _context.GetUserByIdAsync(receiverId);

                var fileUrl = $"/api/file/download/{fileId}";

                var fileMessage = new
                {
                    MessageId = Guid.NewGuid(),
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    MessageText = messageText,
                    Timestamp = DateTime.Now,
                    Sender = sender,
                    Receiver = receiver,
                    FileInfo = new
                    {
                        FileId = file.FileId,
                        OriginalName = file.OriginalName,
                        FileSize = file.FileSize,
                        FileUrl = fileUrl,
                        MimeType = file.MimeType,
                        IsImage = file.MimeType.StartsWith("image/")
                    }
                };

                await Clients.Caller.SendAsync("ReceiveMessage", fileMessage);
                await Clients.User(receiverId.ToString()).SendAsync("ReceiveMessage", fileMessage);
            }
        }

        public async Task DeleteMessage(int messageId )
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var userId))
            {
                Console.WriteLine($"✏️ EditMessage called: messageId={messageId},   userId={userId}");

                // Проверяем, принадлежит ли сообщение пользователю
                var message = await _context.GetMessageByIdAsync(messageId);
                if (message == null)
                {
                    Console.WriteLine("❌ Message not found");
                    throw new HubException("Сообщение не найдено");
                }       

                if (message.SenderId != userId)
                {
                    Console.WriteLine("❌ User not authorized to edit this message");
                    throw new HubException("Вы можете редактировать только свои сообщения");
                }

                // ✅ ОБНОВЛЯЕМ существующее сообщение, а не создаем новое
                var success = await _context.DeleteMessage(messageId);

                if (!success)
                {
                    Console.WriteLine("❌ Failed to update message in database");
                    throw new HubException("Не удалось обновить сообщение");
                }

                Console.WriteLine($"📤 Sending MessageDeleted to caller: {Context.ConnectionId}");
                await Clients.Caller.SendAsync("MessageDeleted", messageId);

                Console.WriteLine($"📤 Sending MessageDeleted to receiver: {message.ReceiverId}");
                await Clients.User(message.ReceiverId.ToString()).SendAsync("MessageDeleted", messageId);
            }
        }

        public async Task ForwardMessage(int originalMessageId, int receiverId, string additionalText = "")
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var senderId))
            {
                // Получаем оригинальное сообщение
                var originalMessage = await _context.GetMessageByIdAsync(originalMessageId);
                if (originalMessage == null)
                {
                    throw new HubException("Сообщение не найдено");
                }

                // Формируем текст пересланного сообщения
                string forwardedText = string.IsNullOrEmpty(additionalText)
                    ? $"↪️ Пересланное сообщение от {originalMessage.Sender.DisplayName}:\n{originalMessage.MessageText}"
                    : $"↪️ {additionalText}\nОт {originalMessage.Sender.DisplayName}:\n{originalMessage.MessageText}";

                // Сохраняем пересланное сообщение
                await _context.AddMessageAsync(senderId, receiverId, forwardedText);

                // Получаем данные пользователей
                var sender = await _context.GetUserByIdAsync(senderId);
                var receiver = await _context.GetUserByIdAsync(receiverId);

                // Отправка пересланного сообщения
                var forwardedMessage = new
                {
                    MessageId = Guid.NewGuid(),
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    MessageText = forwardedText,
                    Timestamp = DateTime.Now,
                    Sender = sender,
                    Receiver = receiver,
                    IsForwarded = true,
                    OriginalSender = originalMessage.Sender.DisplayName
                };

                await Clients.Caller.SendAsync("ReceiveMessage", forwardedMessage);
                await Clients.User(receiverId.ToString()).SendAsync("ReceiveMessage", forwardedMessage);
            }
        }

        public async Task<List<Message>> GetMessageHistory(int selectedUserId)
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var currentUserId))
            {
                return await _context.GetMessagesAsync(currentUserId, selectedUserId);
            }
            return new List<Message>();
        }

        public async Task<List<User>> GetUsers()
        {
            return await _context.GetUsersAsync();
        }

        public async Task<User> GetCurrentUser()
        {
            if (_connectedUsers.TryGetValue(Context.ConnectionId, out var userId))
            {
                return await _context.GetUserByIdAsync(userId);
            }
            return null;
        }
    }
}