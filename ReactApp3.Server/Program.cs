using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using ReactApp3.Server.Controllers;
using ReactApp3.Server.Hubs;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();

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

// УБРАТЬ ДУБЛИРОВАНИЕ - оставить только один вызов!
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

builder.Services.AddAuthorization(options =>
{
    // Разрешаем доступ только аутентифицированным пользователям
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Настраиваем CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy
            .WithOrigins("https://localhost:5173", "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddScoped<FileController>();

var app = builder.Build();

// Middleware pipeline - ВАЖЕН ПОРЯДОК!
app.UseCors("AllowReactApp");
app.UseRouting();

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(@"\\DESKTOP-ME50F7G\asdasdads"),
    RequestPath = "/network-files",
    ServeUnknownFileTypes = true,
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    }
});

// Аутентификация и авторизация
app.UseAuthentication();
app.UseAuthorization();

// Маршруты для хаба SignalR
app.UseEndpoints(endpoints =>
{
    endpoints.MapHub<ChatHub>("/chatHub");
});

app.MapControllers();

app.Run();