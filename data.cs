using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using MySql.Data.MySqlClient;
using ReactApp3.Server.Models;
using System.IO;

namespace ReactApp3.Server.DbContext
{
    public class DatabaseContext
    {
        private readonly string _connectionString;

        public DatabaseContext(string connectionString)
        {
            _connectionString = connectionString;
        }

        // Получение всех пользователей
        public async Task<List<User>> GetUsersAsync()
        {
            var users = new List<User>();

            using (var conn = new MySqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(
                    "SELECT UserId, WindowsUsername, DisplayName, IsOnline, LastSeen FROM Users", conn))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        users.Add(new User
                        {
                            UserId = reader.GetInt32("UserId"),
                            WindowsUsername = reader.GetString("WindowsUsername"),
                            DisplayName = reader.GetString("DisplayName"),
                            IsOnline = reader.GetBoolean("IsOnline"),
                            LastSeen = reader.GetDateTime("LastSeen")
                        });
                    }
                }
            }

            return users;
        }

        public async Task<Message> GetMessageByIdAsync(int messageId)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(@"
            SELECT m.MessageId, m.SenderId, m.ReceiverId, m.MessageText, m.Timestamp,
                   s.WindowsUsername as SenderWindowsUsername, s.DisplayName as SenderDisplayName,
                   r.WindowsUsername as ReceiverWindowsUsername, r.DisplayName as ReceiverDisplayName
            FROM Messages m
            INNER JOIN Users s ON m.SenderId = s.UserId
            INNER JOIN Users r ON m.ReceiverId = r.UserId
            WHERE m.MessageId = @messageId", conn))
                {
                    cmd.Parameters.AddWithValue("@messageId", messageId);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new Message
                            {
                                MessageId = reader.GetInt32("MessageId"),
                                SenderId = reader.GetInt32("SenderId"),
                                ReceiverId = reader.GetInt32("ReceiverId"),
                                MessageText = reader.GetString("MessageText"),
                                Timestamp = reader.GetDateTime("Timestamp"),
                                Sender = new User
                                {
                                    UserId = reader.GetInt32("SenderId"),
                                    WindowsUsername = reader.GetString("SenderWindowsUsername"),
                                    DisplayName = reader.GetString("SenderDisplayName")
                                },
                                Receiver = new User
                                {
                                    UserId = reader.GetInt32("ReceiverId"),
                                    WindowsUsername = reader.GetString("ReceiverWindowsUsername"),
                                    DisplayName = reader.GetString("ReceiverDisplayName")
                                }
                            };
                        }
                    }
                }
            }
            return null;
        }

        // Получение пользователя по Windows username
        public async Task<User> GetUserByWindowsUsernameAsync(string windowsUsername)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(
                    "SELECT UserId, WindowsUsername FROM Users WHERE WindowsUsername = @windowsUsername", conn))
                {
                    cmd.Parameters.AddWithValue("@windowsUsername", windowsUsername);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new User
                            {
                                UserId = reader.GetInt32("UserId"),
                                WindowsUsername = reader.GetString("WindowsUsername"),
                                 
                            };
                        }
                    }
                }
                return null;
            }

            
        }

        // Получение сообщений между двумя пользователями
        public async Task<List<Message>> GetMessagesAsync(int currentUserId, int selectedUserId)
        {
            try
            {
                var messages = new List<Message>();

                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand(@"
                        SELECT m.MessageId, m.SenderId, m.ReceiverId, m.MessageText, m.Timestamp,
                        s.WindowsUsername as SenderWindowsUsername, s.DisplayName as SenderDisplayName,
                         r.WindowsUsername as ReceiverWindowsUsername, r.DisplayName as ReceiverDisplayName
                        FROM Messages m
                        INNER JOIN Users s ON m.SenderId = s.UserId
                         INNER JOIN Users r ON m.ReceiverId = r.UserId
                        WHERE (m.SenderId = @currentUserId AND m.ReceiverId = @selectedUserId and IsDelete is null )
                        OR (m.SenderId = @selectedUserId AND m.ReceiverId = @currentUserId and IsDelete is NULL)
                        ORDER BY m.Timestamp ASC
                                                ", conn))
                    {
                        cmd.Parameters.AddWithValue("@currentUserId", currentUserId);
                        cmd.Parameters.AddWithValue("@selectedUserId", selectedUserId);

                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                messages.Add(new Message
                                {
                                    MessageId = reader.GetInt32("MessageId"),
                                    SenderId = reader.GetInt32("SenderId"),
                                    ReceiverId = reader.GetInt32("ReceiverId"),
                                    MessageText = reader.GetString("MessageText"),
                                    Timestamp = reader.GetDateTime("Timestamp"),
                                    Sender = new User
                                    {
                                        UserId = reader.GetInt32("SenderId"),
                                        WindowsUsername = reader.GetString("SenderWindowsUsername"),
                                        DisplayName = reader.GetString("SenderDisplayName")
                                    },
                                    Receiver = new User
                                    {
                                        UserId = reader.GetInt32("ReceiverId"),
                                        WindowsUsername = reader.GetString("ReceiverWindowsUsername"),
                                        DisplayName = reader.GetString("ReceiverDisplayName")
                                    }
                                });
                            }
                        }
                    }
                }

                return messages;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в GetMessagesAsync: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> UpdateMessageAsync(int messageId, string newMessageText)
        {
            try
            {
                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand(
                        "UPDATE Messages SET MessageText = @newMessageText, IsEdited = 1, EditedTimestamp = NOW() " +
                        "WHERE MessageId = @messageId", conn))
                    {
                        cmd.Parameters.AddWithValue("@newMessageText", newMessageText);
                        cmd.Parameters.AddWithValue("@messageId", messageId);

                        var rowsAffected = await cmd.ExecuteNonQueryAsync();
                        return rowsAffected > 0;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в UpdateMessageAsync: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> DeleteMessage(int messageId)
        {
            try
            {
                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand(
                        @"UPDATE Messages SET IsDelete = 1 
                        WHERE MessageId = @messageId", conn))
                    {

                        cmd.Parameters.AddWithValue("@messageId", messageId);

                        var rowsAffected = await cmd.ExecuteNonQueryAsync();
                        return rowsAffected > 0;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в UpdateMessageAsync: {ex.Message}");
                throw;
            }
        }

        // Добавление сообщения
        public async Task<int> AddMessageAsync(int senderId, int receiverId, string messageText)
        {
            try
            {
                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();

                    // Используем OUTPUT или RETURNING для получения ID вставленной записи
                    using (var cmd = new MySqlCommand(
                        "INSERT INTO Messages (SenderId, ReceiverId, MessageText, Timestamp) " +
                        "VALUES (@senderId, @receiverId, @messageText, NOW()); " +
                        "SELECT LAST_INSERT_ID();", conn))
                    {
                        cmd.Parameters.AddWithValue("@senderId", senderId);
                        cmd.Parameters.AddWithValue("@receiverId", receiverId);
                        cmd.Parameters.AddWithValue("@messageText", messageText);

                        // Выполняем запрос и получаем ID вставленной записи
                        var messageId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                        return messageId;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в AddMessageAsync: {ex.Message}");
                throw;
            }
        }
        // Обновление статуса онлайн
        public async Task UpdateUserStatusAsync(int userId, bool isOnline)
        {
            try
            {
                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand(
                        "UPDATE Users SET IsOnline = @isOnline, LastSeen = @lastSeen WHERE UserId = @userId", conn))
                    {
                        cmd.Parameters.AddWithValue("@isOnline", isOnline);
                        cmd.Parameters.AddWithValue("@lastSeen", DateTime.Now);
                        cmd.Parameters.AddWithValue("@userId", userId);
                        await cmd.ExecuteNonQueryAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в UpdateUserStatusAsync: {ex.Message}");
                throw;
            }
        }

        public async Task<User> GetUserByIdAsync(int userId)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(
                    "SELECT UserId, WindowsUsername, DisplayName, IsOnline, LastSeen FROM Users WHERE UserId = @userId", conn))
                {
                    cmd.Parameters.AddWithValue("@userId", userId);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new User
                            {
                                UserId = reader.GetInt32("UserId"),
                                WindowsUsername = reader.GetString("WindowsUsername"),
                                DisplayName = reader.GetString("DisplayName"),
                                IsOnline = reader.GetBoolean("IsOnline"),
                                LastSeen = reader.GetDateTime("LastSeen")
                            };
                        }
                    }
                }
            }
            return null;
        }


        
        // Создание тестовых пользователей
        public async Task<User> CreateUserAsync(string username, string displayname)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                string simpleUsername = displayname;
                if(displayname.Contains("\\"))
                {
                    simpleUsername = displayname.Split('\\')[1];
                }

                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(
                    "INSERT INTO Users(WindowsUsername, DisplayName, IsOnline, LastSeen) values (@user, @display, @online, @lastseen) ;", conn))
                {
                    cmd.Parameters.AddWithValue("@user", username);
                    cmd.Parameters.AddWithValue("@display", simpleUsername);
                    cmd.Parameters.AddWithValue("@online", false);
                    cmd.Parameters.AddWithValue("@lastseen", DateTime.UtcNow);


                    var userId = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                    return new User
                    {
                        UserId = userId,
                        WindowsUsername = username,
                        DisplayName = displayname,
                        IsOnline = false,
                        LastSeen = DateTime.UtcNow

                    };
                }
            }
        }

        // Добавьте using для IO

        // Обновите методы работы с файлами
        public async Task<FileModel> AddFileAsync(string fileName, string originalName, string filePath, long fileSize, string mimeType, int userId)
        {
            try
            {
                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand(
                        "INSERT INTO Files (FileName, OriginalName, FilePath, FileSize, MimeType, UserId) VALUES (@fileName, @originalName, @filePath, @fileSize, @mimeType, @userId); SELECT LAST_INSERT_ID();", conn))
                    {
                        cmd.Parameters.AddWithValue("@fileName", fileName);
                        cmd.Parameters.AddWithValue("@originalName", originalName);
                        cmd.Parameters.AddWithValue("@filePath", filePath);
                        cmd.Parameters.AddWithValue("@fileSize", fileSize);
                        cmd.Parameters.AddWithValue("@mimeType", mimeType);
                        cmd.Parameters.AddWithValue("@userId", userId);

                        var fileId = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                        return new FileModel
                        {
                            FileId = fileId,
                            FileName = fileName,
                            OriginalName = originalName,
                            FilePath = filePath,
                            FileSize = fileSize,
                            MimeType = mimeType,
                            UserId = userId,
                            UploadedAt = DateTime.Now
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в AddFileAsync: {ex.Message}");
                throw;
            }
        }

        public async Task<FileModel> GetFileByIdAsync(int fileId)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(
                    "SELECT f.*, u.WindowsUsername, u.DisplayName FROM Files f INNER JOIN Users u ON f.UserId = u.UserId WHERE f.FileId = @fileId", conn))
                {
                    cmd.Parameters.AddWithValue("@fileId", fileId);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new FileModel
                            {
                                FileId = reader.GetInt32("FileId"),
                                FileName = reader.GetString("FileName"),
                                OriginalName = reader.GetString("OriginalName"),
                                FilePath = reader.GetString("FilePath"),
                                FileSize = reader.GetInt64("FileSize"),
                                MimeType = reader.GetString("MimeType"),
                                UserId = reader.GetInt32("UserId"),
                                UploadedAt = reader.GetDateTime("UploadedAt"),
                                User = new User
                                {
                                    UserId = reader.GetInt32("UserId"),
                                    WindowsUsername = reader.GetString("WindowsUsername"),
                                    DisplayName = reader.GetString("DisplayName")
                                }
                            };
                        }
                    }
                }
            }
            return null;
        }

        public async Task<List<FileModel>> GetUserFilesAsync(int userId)
        {
            var files = new List<FileModel>();

            using (var conn = new MySqlConnection(_connectionString))
            {
                await conn.OpenAsync();
                using (var cmd = new MySqlCommand(
                    "SELECT f.*, u.WindowsUsername, u.DisplayName FROM Files f INNER JOIN Users u ON f.UserId = u.UserId WHERE f.UserId = @userId ORDER BY f.UploadedAt DESC", conn))
                {
                    cmd.Parameters.AddWithValue("@userId", userId);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            files.Add(new FileModel
                            {
                                FileId = reader.GetInt32("FileId"),
                                FileName = reader.GetString("FileName"),
                                OriginalName = reader.GetString("OriginalName"),
                                FilePath = reader.GetString("FilePath"),
                                FileSize = reader.GetInt64("FileSize"),
                                MimeType = reader.GetString("MimeType"),
                                UserId = reader.GetInt32("UserId"),
                                UploadedAt = reader.GetDateTime("UploadedAt"),
                                User = new User
                                {
                                    UserId = reader.GetInt32("UserId"),
                                    WindowsUsername = reader.GetString("WindowsUsername"),
                                    DisplayName = reader.GetString("DisplayName")
                                }
                            });
                        }
                    }
                }
            }
            return files;
        }

    }
}
