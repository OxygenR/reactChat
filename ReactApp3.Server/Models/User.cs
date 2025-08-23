namespace ReactApp3.Server.Models
{
    public class User
    {
        public int UserId { get; set; }
        public string WindowsUsername { get; set; }
        public string DisplayName { get; set; }
        public bool IsOnline { get; set; }
        public DateTime LastSeen { get; set; }
    }
}