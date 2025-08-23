using Microsoft.AspNetCore.Mvc;
using ReactApp3.Server.DbContext;
using ReactApp3.Server.Models;
using System.IO;

namespace ReactApp3.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FileController : ControllerBase
    {
        private readonly DatabaseContext _databaseContext;
        private readonly IWebHostEnvironment _environment;

        public FileController(IConfiguration configuration, IWebHostEnvironment environment)
        {
            var connect = configuration.GetConnectionString("DefaultConnection");
            _databaseContext = new DatabaseContext(connect);
            _environment = environment;
        }

        [HttpPost("upload")]
        public async Task<ActionResult> UploadFile(IFormFile file, [FromForm] int userId)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest("Файл не выбран");

                if (file.Length > 10 * 1024 * 1024)
                    return BadRequest("Файл слишком большой. Максимальный размер: 10MB");

                var uploadsPath = Path.Combine("D:\\", "uploads");
                if (!Directory.Exists(uploadsPath))
                    Directory.CreateDirectory(uploadsPath);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var fileRecord = await _databaseContext.AddFileAsync(
                    fileName,
                    file.FileName,
                    filePath,
                    file.Length,
                    file.ContentType,
                    userId
                );

                var fileUrl = $"/api/file/download/{fileRecord.FileId}";

                return Ok(new
                {
                    success = true,
                    fileId = fileRecord.FileId,
                    url = fileUrl,
                    originalName = file.FileName
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка при загрузке файла: {ex.Message}");
            }
        }

        [HttpGet("download/{fileId}")]
        public async Task<IActionResult> DownloadFile(int fileId)
        {
            try
            {
                var fileRecord = await _databaseContext.GetFileByIdAsync(fileId);
                if (fileRecord == null)
                    return NotFound("Файл не найден");

                if (!System.IO.File.Exists(fileRecord.FilePath))
                    return NotFound("Файл не существует на сервере");

                var fileBytes = await System.IO.File.ReadAllBytesAsync(fileRecord.FilePath);
                return File(fileBytes, fileRecord.MimeType, fileRecord.OriginalName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка при загрузке файла: {ex.Message}");
            }
        }

        [HttpGet("user/{userId}")]
        public async Task<ActionResult<IEnumerable<FileModel>>> GetUserFiles(int userId)
        {
            try
            {
                var files = await _databaseContext.GetUserFilesAsync(userId);
                return Ok(files);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка при получении файлов: {ex.Message}");
            }
        }
    }
}