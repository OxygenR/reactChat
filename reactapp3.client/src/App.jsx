import  { useState, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';

function App() {
    const [connection, setConnection] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessageText] = useState('');
   
    useEffect(() => {
        // Создание подключения
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl('http://localhost:5246/chatHub'  )
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);
    }, []);

    useEffect(() => {
        if (connection) {
            connection
                .start()
                .then(() => {
                    console.log('Подключено к SignalR');
                        
                    // Получение истории сообщений
                    connection.invoke('GetMessageHistory')
                        .then(messages => {
                            setMessages(messages);
                        })
                        .catch(error => console.error('2222', error));

                    // Обработка получения новых сообщений
                    connection.on('ReceiveMessage', (message) => {
                        setMessages(prevMessages => [...prevMessages, message]);
                    });
                })
                .catch(error => console.error('1', error));
        }
    }, [connection]);

    const sendMessage = async () => {
        if (connection && connection.state === signalR.HubConnectionState.Connected) {
            try {
                connection.invoke('SendMessage', message);
                console.log('Сообщение отправлено на сервер 3:', message);
                 
            } catch (error) {
                console.error('Ошибка при отправке сообщения 2:', error);
            }
        } else {
            console.error('Нет соединения с сервером 1.');
        }
    };

    return (
        <div className="App">
            <h1>Анонимный чат</h1>
            <div className="chat-window" style={{ border: '1px solid #ccc', padding: '10px', maxHeight: '400px', overflowY: 'scroll' }}>
                {messages.map((msg) => (
                    <div key={msg.messageId}>
                        {/* Так как у нас нет имени пользователя, просто отображаем сообщение и время */}
                        {msg.messageText} <em>{new Date(msg.timestamp).toLocaleTimeString()}</em>
                    </div>
                ))}
            </div>
            <form onSubmit={sendMessage}>
                <textarea
                    value={message}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Ваше сообщение"
                    required
                />
                <br />
                <button type="submit">Отправить</button>
            </form>
        </div>
    );
}

export default App;
