using Microsoft.AspNetCore.SignalR;
using ReactApp3.Server.Models;
using ReactApp3.Server.DbContext;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using static System.Net.Mime.MediaTypeNames;

namespace ReactApp3.Server.Hubs
{
    public class ChatHub : Hub
    {
        private readonly DatabaseContext _context;

        public ChatHub(IConfiguration configuration)
        {
            var conn = configuration.GetConnectionString("DefaultConnection");
            _context = new DatabaseContext(conn);
        }

        public async Task SendMessage(   string message)
        {
            // Сохранение сообщения в базе данных
            await _context.AddMessageAsync(message);

            // Отправка сообщения подключенным клиентам
            await Clients.All.SendAsync("ReceiveMessage",   message);
        }


        public async Task<List<Message>> GetMessageHistory()
        {
            return await _context.GetMessagesAsync();
        }
    }
}

