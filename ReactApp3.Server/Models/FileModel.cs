namespace ReactApp3.Server.Models
{
    public class FileModel
    {
        public int FileId { get; set; }
        public string FileName { get; set; }
        public string OriginalName { get; set; }
        public string FilePath { get; set; }
        public long FileSize { get; set; }
        public string MimeType { get; set; }
        public int UserId { get; set; }
        public DateTime UploadedAt { get; set; }
        public User User { get; set; }
    }
}