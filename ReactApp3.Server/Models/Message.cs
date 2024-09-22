namespace ReactApp3.Server.Models
{
    public class Message
    {
        public int MessageId { get; set; } // Идентификатор сообщения
         
        public string MessageText { get; set; } // Текст сообщения
        public DateTime Timestamp { get; set; } // Время отправки сообщения
    }
}
