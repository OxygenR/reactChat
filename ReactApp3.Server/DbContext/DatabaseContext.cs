 
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using ReactApp3.Server.Models;
using MySql.Data.MySqlClient;
using System.Data;

namespace ReactApp3.Server.DbContext
{
    public class DatabaseContext
    {
        private readonly string _connectionString;

        public DatabaseContext(string connectionString)
        {
            _connectionString = connectionString;
        }

        public async Task<List<Message>> GetMessagesAsync()
        {
            try
            {
                var messages = new List<Message>();

                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand(
                               "SELECT MessageId, MessageText, Timestamp FROM Messages ORDER BY Timestamp ASC", conn))
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            messages.Add(new Message
                            {
                                MessageId = reader.GetInt32("MessageId"),
                                MessageText = reader.GetString("MessageText"),
                                Timestamp = reader.GetDateTime("Timestamp")
                            });
                        }
                    }
                }

                return messages;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка в GetMessageHistory: {ex.Message}");
                throw; // Повторно бросаем исключение, чтобы клиент получил информацию об ошибке}
            }

        }

        public async Task AddMessageAsync(string messageText)
        {
            try
            {
                using (var conn = new MySqlConnection(_connectionString))
                {
                    await conn.OpenAsync();
                    using (var cmd = new MySqlCommand("INSERT INTO Messages (MessageText) VALUES (@messageText)", conn))
                    {
                        cmd.Parameters.AddWithValue("@messageText", messageText);
                        await cmd.ExecuteScalarAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
            }
        }
    }
}
