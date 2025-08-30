using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
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
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = options.DefaultPolicy;
});
// Настраиваем CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy
            .WithOrigins("https://localhost:5173") // Или "http://localhost:5173", если используете HTTP
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();
app.UseCors("AllowReactApp");
app.UseRouting();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
// Применяем CORS


// Маршруты для хаба SignalR
app.UseEndpoints(endpoints =>
{
    endpoints.MapHub<ChatHub>("/chatHub");
});

 

app.Run();