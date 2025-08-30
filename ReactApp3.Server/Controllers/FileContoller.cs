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
        private readonly string _networkPath = @"\\DESKTOP-ME50F7G\asdasdads\";

        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile()
        {
            try
            {
                if (Request.Form.Files.Count == 0)
                    return BadRequest("No file provided");

                var file = Request.Form.Files[0];
                string fileName = $"{DateTime.Now:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}_{file.FileName}";

                var networkPath = @"\\DESKTOP-ME50F7G\asdasdads\";
                if (!Directory.Exists(networkPath))
                    Directory.CreateDirectory(networkPath);

                var fullPath = Path.Combine(networkPath, fileName);

                // Сохраняем оригинальный файл
                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Для изображений создаем и сохраняем превью
                string previewFileName = null;
                var extension = Path.GetExtension(fileName).ToLower();
                var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" };

                if (imageExtensions.Contains(extension))
                {
                    previewFileName = $"preview_{fileName}";
                    var previewPath = Path.Combine(networkPath, previewFileName);

                    // Создаем превью (упрощенная версия)
                    using (var imageStream = file.OpenReadStream())
                    using (var outputStream = new FileStream(previewPath, FileMode.Create))
                    {
                        await imageStream.CopyToAsync(outputStream);
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = "File uploaded successfully",
                    fileName = fileName,
                    previewFileName = previewFileName, // ← возвращаем имя файла превью
                    filePath = fullPath,
                    fileSize = file.Length
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }

        [HttpGet("download/{fileName}")]
        public IActionResult DownloadFile(string fileName)
        {
            try
            {
                var fullPath = Path.Combine(_networkPath, fileName);

                if (!System.IO.File.Exists(fullPath))
                    return NotFound();

                var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
                return File(fileStream, "application/octet-stream", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка загрузки файла: {ex.Message}");
            }
        }
        [HttpGet("preview/{fileName}")]
        public IActionResult GetPreview(string fileName)
        {
            try
            {
                var networkPath = @"\\DESKTOP-ME50F7G\asdasdads\";
                var fullPath = Path.Combine(networkPath, fileName);

                if (!System.IO.File.Exists(fullPath))
                    return NotFound();

                var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
                return File(fileStream, "image/jpeg"); // или определяйте MIME type по расширению
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Preview error: {ex.Message}");
            }
        }

        private string GetMimeType(string extension)
        {
            return extension switch
            {
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };
        }
    }
}