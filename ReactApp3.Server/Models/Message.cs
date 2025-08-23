namespace ReactApp3.Server.Models
{
    public class Message
    {
        public int MessageId { get; set; }
        public int SenderId { get; set; }
        public int ReceiverId { get; set; }
        public string MessageText { get; set; }
        public DateTime Timestamp { get; set; }

         

        // Навигационные свойства
        public User Sender { get; set; }
        public User Receiver { get; set; }
    }
}