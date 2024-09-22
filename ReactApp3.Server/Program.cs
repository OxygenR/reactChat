using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ReactApp3.Server.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Настраиваем Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(7192, listenOptions =>
    {
        listenOptions.UseHttps(); // Используем HTTPS на порту 7192
    });
    options.ListenLocalhost(5246); // Используем HTTP на порту 5246
});

// Добавляем службы
builder.Services.AddSignalR();

// Настраиваем CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy
            .WithOrigins("https://localhost:5173") // Или "http://localhost:5173", если используете HTTP
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseRouting();

// Применяем CORS
app.UseCors("CorsPolicy");

// Маршруты для хаба SignalR
app.UseEndpoints(endpoints =>
{
    endpoints.MapHub<ChatHub>("/chatHub");
});

app.Run();