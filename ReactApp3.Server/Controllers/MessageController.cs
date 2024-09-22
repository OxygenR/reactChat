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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Message>>> GetMessage()
        {
            var messages = await _databaseContext.GetMessagesAsync();
            return Ok(messages);
        }
    }
}
