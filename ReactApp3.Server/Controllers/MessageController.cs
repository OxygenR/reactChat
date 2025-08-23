using Microsoft.AspNetCore.Mvc;
using ReactApp3.Server.DbContext;
using ReactApp3.Server.Models;

namespace ReactApp3.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessageController : ControllerBase
    {
        private readonly DatabaseContext _databaseContext;

        public MessageController(IConfiguration configuration)
        {
            var connect = configuration.GetConnectionString("DefaultConnection");
            _databaseContext = new DatabaseContext(connect);
        }

        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers()
        {
            var users = await _databaseContext.GetUsersAsync();
            return Ok(users);
        }

        [HttpGet("history/{selectedUserId}")]
        public async Task<ActionResult<IEnumerable<Message>>> GetMessageHistory(int selectedUserId)
        {
            // Здесь нужно получить currentUserId из аутентификации
            // Для примера используем 1
            var messages = await _databaseContext.GetMessagesAsync(1, selectedUserId);
            return Ok(messages);
        }
    }
}