import { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import './App.css';

function App() {
    const [connection, setConnection] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessageText] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const connectionStarted = useRef(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [originalMessage, setOriginalMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [clipboardPermission, setClipboardPermission] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        message: null
    });

    const [forwardDialog, setForwardDialog] = useState({
        visible: false,
        comment: '',
        multiple: false
    });

    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl('http://localhost:5246/chatHub')
            .configureLogging(signalR.LogLevel.Information)
            .withAutomaticReconnect()
            .build();

        newConnection.onclose(() => {
            console.log('Соединение закрыто');
            setConnectionStatus('Disconnected');
        });

        newConnection.onreconnecting(() => {
            console.log('Переподключение...');
            setConnectionStatus('Reconnecting');
        });

        newConnection.onreconnected(() => {
            console.log('Переподключено');
            setConnectionStatus('Connected');
        });

        setConnection(newConnection);

        return () => {
            if (newConnection) {
                newConnection.stop();
            }
        };
    }, []);

    useEffect(() => {
        // Глобальные функции для обработки кликов
        window.openImageInViewer = (imagePath) => {
            const modal = document.createElement('div');
            modal.className = 'image-modal-overlay';
            modal.innerHTML = `
                <div class="image-modal">
                    <div class="image-modal-header">
                        <h3>Просмотр изображения</h3>
                        <button class="modal-close" onclick="this.closest('.image-modal-overlay').remove()">×</button>
                    </div>
                    <div class="image-modal-content">
                        <img src="file:///${imagePath.replace(/\\/g, '/')}" 
                             alt="Изображение" 
                             class="modal-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                        <div style="display: none; padding: 20px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                            <p>Не удалось загрузить изображение</p>
                            <p style="font-size: 12px; color: #666; margin-top: 10px;">${imagePath}</p>
                        </div>
                    </div>
                    <div class="image-modal-footer">
                        <button class="modal-button copy-button" onclick="window.copyToClipboard('${imagePath.replace(/'/g, "\\'")}')">
                            📋 Скопировать путь
                        </button>
                        <button class="modal-button" onclick="window.open('file:///${imagePath.replace(/\\/g, '/')}', '_blank')">
                            📂 Открыть в проводнике
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };

        window.openFileInViewer = (fileUrl, fileName) => {
            const modal = document.createElement('div');
            modal.className = 'image-modal-overlay';
            modal.innerHTML = `
                <div class="image-modal">
                    <div class="image-modal-header">
                        <h3>${fileName}</h3>
                        <button class="modal-close" onclick="this.closest('.image-modal-overlay').remove()">×</button>
                    </div>
                    <div class="image-modal-content">
                        <img src="${fileUrl}" 
                             alt="${fileName}" 
                             class="modal-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                        <div style="display: none; padding: 20px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                            <p>Не удалось загрузить изображение</p>
                            <p style="font-size: 12px; color: #666; margin-top: 10px;">${fileName}</p>
                        </div>
                    </div>
                    <div class="image-modal-footer">
                        <a href="${fileUrl}" 
                           download="${fileName}"
                           class="modal-button">
                            📥 Скачать файл
                        </a>
                        <button class="modal-button copy-button" onclick="window.copyToClipboard('${fileUrl}')">
                            📋 Скопировать ссылку
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };

        window.openImageInNewTab = (url) => {
            window.open(url, '_blank', 'noopener,noreferrer');
        };

        window.openLocalImage = (path) => {
            const cleanPath = path.replace(/\\/g, '/');
            window.open(`file:///${cleanPath}`, '_blank', 'noopener,noreferrer');
        };

        window.copyToClipboard = (text) => {
            navigator.clipboard.writeText(text).then(() => {
                alert('Скопировано в буфер обмена!');
            }).catch(err => {
                console.error('Ошибка копирования:', err);
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Скопировано в буфер обмена!');
            });
        };

        return () => {
            delete window.openImageInViewer;
            delete window.openFileInViewer;
            delete window.openImageInNewTab;
            delete window.openLocalImage;
            delete window.copyToClipboard;
        };
    }, []);

    useEffect(() => {
        // Проверка разрешения на доступ к буферу обмена
        const checkClipboardPermission = async () => {
            try {
                if (navigator.permissions) {
                    const permissionStatus = await navigator.permissions.query({
                        name: 'clipboard-read'
                    });

                    setClipboardPermission(permissionStatus.state === 'granted');

                    permissionStatus.onchange = () => {
                        setClipboardPermission(permissionStatus.state === 'granted');
                    };
                }
            } catch (error) {
                console.log('Проверка разрешения буфера обмена не поддерживается:', error);
            }
        };

        checkClipboardPermission();
    }, []);

    useEffect(() => {
        if (connection && !connectionStarted.current) {
            connectionStarted.current = true;

            connection.start()
                .then(() => {
                    console.log('Подключено к SignalR');
                    setConnectionStatus('Connected');
                    loadUsers();
                    getCurrentUser();
                })
                .catch(error => {
                    console.error('Ошибка подключения:', error);
                    setConnectionStatus('Connection Failed');
                });

            connection.on('ReceiveMessage', (message) => {
                console.log('Получено сообщение:', message);
                if (!selectedUser || message.SenderId === selectedUser.userId || message.ReceiverId === selectedUser.userId) {
                    setMessages(prev => [...prev, normalizeMessage(message)]);
                }
            });

            connection.on('UserStatusChanged', (userId, isOnline) => {
                setUsers(prev => prev.map(user =>
                    user.userId === userId ? { ...user, isOnline } : user
                ));
            });

            connection.on('MessageDeleted', (messageId) => {
                setMessages(prev => prev.filter(msg => {
                    const msgId = parseInt(msg.messageId);
                    const deletedId = parseInt(messageId);
                    return msgId !== deletedId;
                }));
                // Удаляем сообщение из выбранных
                setSelectedMessages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(messageId.toString());
                    return newSet;
                });
            });

            connection.on('MessageEdited', (editedMessage) => {
                const possibleIdKeys = ['MessageId', 'messageId', 'id', 'Id'];
                let actualMessageId = null;

                for (const key of possibleIdKeys) {
                    if (editedMessage[key] !== undefined) {
                        actualMessageId = editedMessage[key];
                        break;
                    }
                }

                if (actualMessageId === null) return;

                setMessages(prev => {
                    const editedMessageId = parseInt(actualMessageId);
                    if (isNaN(editedMessageId)) return prev;

                    const messageIndex = prev.findIndex(msg => {
                        const msgId = parseInt(msg.messageId);
                        return msgId === editedMessageId;
                    });

                    if (messageIndex !== -1) {
                        const newMessages = [...prev];
                        newMessages[messageIndex] = {
                            ...newMessages[messageIndex],
                            messageText: editedMessage.MessageText || editedMessage.messageText,
                            formattedText: detectAndFormatLinks(editedMessage.MessageText || editedMessage.messageText),
                            timestamp: new Date(editedMessage.Timestamp || editedMessage.timestamp),
                            isEdited: true,
                            editedTimestamp: new Date(editedMessage.EditedTimestamp || editedMessage.editedTimestamp)
                        };
                        return newMessages;
                    }
                    return prev;
                });
            });
        }
    }, [connection, selectedUser]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (contextMenu.visible) {
                setContextMenu({ visible: false, x: 0, y: 0, message: null });
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu.visible]);

    // Дебаунс поиска
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchUsers(searchTerm);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const searchUsers = async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Ищем среди уже загруженных пользователей
            const filteredUsers = users.filter(user =>
                user.displayName?.toLowerCase().includes(query.toLowerCase()) ||
                user.windowsUsername?.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(filteredUsers);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const loadUsers = async () => {
        try {
            const usersList = await connection.invoke('GetUsers');
            setUsers(usersList.map(user => ({
                userId: user.userId,
                windowsUsername: user.windowsUsername,
                displayName: user.displayName,
                isOnline: user.isOnline,
                lastSeen: new Date(user.lastSeen)
            })));
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    };

    const getCurrentUser = async () => {
        try {
            const user = await connection.invoke('GetCurrentUser');
            if (user) {
                setCurrentUser({
                    userId: user.userId,
                    windowsUsername: user.windowsUsername,
                    displayName: user.displayName,
                    isOnline: user.isOnline
                });
            }
        } catch (error) {
            console.error('Ошибка получения текущего пользователя:', error);
        }
    };

    const loadMessageHistory = async (userId) => {
        if (!connection) return;
        try {
            const history = await connection.invoke('GetMessageHistory', userId);
            setMessages(history.map(normalizeMessage));
            // Сбрасываем выбранные сообщения при смене чата
            setSelectedMessages(new Set());
            setIsMultiSelectMode(false);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    };

    const handleContextMenu = (e, message) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            message: message
        });
    };

    const toggleMessageSelection = (messageId) => {
        setSelectedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const selectAllMessages = () => {
        const allMessageIds = messages.map(msg => msg.messageId.toString());
        setSelectedMessages(new Set(allMessageIds));
    };

    const clearSelection = () => {
        setSelectedMessages(new Set());
    };

    const forwardMessage = async (receiverId, additionalText = "") => {
        if (!connection) return;

        try {
            if (forwardDialog.multiple && selectedMessages.size > 0) {
                // Пересылка нескольких сообщений
                for (const messageId of selectedMessages) {
                    const message = messages.find(msg => msg.messageId.toString() === messageId);
                    if (message) {
                        await connection.invoke('ForwardMessage',
                            message.messageId,
                            receiverId,
                            additionalText
                        );
                    }
                }
            } else if (contextMenu.message) {
                // Пересылка одного сообщения
                await connection.invoke('ForwardMessage',
                    contextMenu.message.messageId,
                    receiverId,
                    additionalText
                );
            }

            setContextMenu({ visible: false, x: 0, y: 0, message: null });
            setForwardDialog({ visible: false, comment: '', multiple: false });
            setSelectedMessages(new Set());
            setIsMultiSelectMode(false);
        } catch (error) {
            console.error('Ошибка при пересылке сообщения:', error);
            alert('Не удалось переслать сообщение');
        }
    };

    const deleteMessage = async (messageId = null) => {
        if (!connection) return;

        const messageIdsToDelete = messageId ? [messageId] : Array.from(selectedMessages);

        if (messageIdsToDelete.length === 0) return;

        if (window.confirm(`Вы уверены, что хотите удалить ${messageIdsToDelete.length} сообщений?`)) {
            try {
                for (const id of messageIdsToDelete) {
                    await connection.invoke('DeleteMessage', id);
                }
                setSelectedMessages(new Set());
                setIsMultiSelectMode(false);
            } catch (error) {
                console.error('Ошибка при удалении сообщения:', error);
                alert('Не удалось удалить сообщение');
            }
        }
        setContextMenu({ visible: false, x: 0, y: 0, message: null });
    };

    const deleteSelectedMessages = async () => {
        await deleteMessage();
    };

    const editMessage = async () => {
        if (!connection || !contextMenu.message) return;
        setEditingMessage(contextMenu.message);
        setMessageText(contextMenu.message.messageText);
        setOriginalMessage(contextMenu.message.messageText);
        setContextMenu({ visible: false, x: 0, y: 0, message: null });

        setTimeout(() => {
            const textarea = document.querySelector('textarea');
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        }, 100);
    };

    const sendEditedMessage = async (e) => {
        e.preventDefault();
        if (!editingMessage || !message.trim() || message === originalMessage || !connection) return;

        try {
            await connection.invoke('EditMessage', editingMessage.messageId, message);
            setEditingMessage(null);
            setOriginalMessage('');
            setMessageText('');
        } catch (error) {
            console.error('❌ Error editing message:', error);
            alert('Не удалось отредактировать сообщение: ' + error.message);
        }
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setOriginalMessage('');
        setMessageText('');
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const detectAndFormatLinks = (text, fileInfo = null) => {
        if (!text && !fileInfo) return '';

        let result = '';

        if (fileInfo) {
            const fileSizeFormatted = formatFileSize(fileInfo.FileSize);
            if (fileInfo.IsImage) {
                result += `
                <div class="file-container image-file">
                    <img src="${fileInfo.FileUrl}" 
                         alt="${fileInfo.OriginalName}"
                         class="file-preview"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"
                         onclick="window.openFileInViewer('${fileInfo.FileUrl}', '${fileInfo.OriginalName}')">
                    <div class="image-fallback" style="display: none;">
                        <span class="image-icon">🖼️</span>
                        <span class="image-path">${fileInfo.OriginalName}</span>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${fileInfo.OriginalName}</div>
                        <div class="file-size">${fileSizeFormatted}</div>
                        <a href="${fileInfo.FileUrl}" 
                           download="${fileInfo.OriginalName}"
                           class="file-download-btn"
                           onclick="event.stopPropagation()">
                            📥 Скачать
                        </a>
                    </div>
                </div>
            `;
            } else {
                result += `
                <div class="file-container">
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                        <div class="file-name">${fileInfo.OriginalName}</div>
                        <div class="file-size">${fileSizeFormatted}</div>
                        <a href="${fileInfo.FileUrl}" 
                           download="${fileInfo.OriginalName}"
                           class="file-download-btn">
                            📥 Скачать (${fileSizeFormatted})
                        </a>
                    </div>
                </div>
            `;
            }
        }

        // Обработка текстовых ссылок, включая URL файлов
        if (text) {
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\\\\[^\s]+\\[^\s]+|[\w]:\\[^\s]+)/gi;
            const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
            const isHttpUrl = /^https?:\/\//i;
            const isFileUrl = /http:\/\/localhost:3001\/uploads\//i;

            const formattedText = text.replace(linkRegex, (match) => {
                // Проверяем, является ли это URL файла с нашего сервера
                if (isFileUrl.test(match)) {
                    const fileName = match.split('/').pop();
                    const isImage = imageExtensions.test(fileName);

                    if (isImage) {
                        return `
                    <div class="uploaded-file image-file">
                        <img src="${match}" 
                             alt="${fileName}"
                             class="file-preview"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"
                             onclick="window.openFileInViewer('${match}', '${fileName}')">
                        <div class="image-fallback" style="display: none;">
                            <span class="image-icon">🖼️</span>
                            <span class="image-name">${fileName}</span>
                        </div>
                        <div class="file-info">
                            <a href="${match}" 
                               download="${fileName}"
                               class="file-download-link">
                                📥 ${fileName}
                            </a>
                        </div>
                    </div>
                    `;
                    } else {
                        return `
                    <div class="uploaded-file">
                        <div class="file-icon">📄</div>
                        <div class="file-info">
                            <a href="${match}" 
                               download="${fileName}"
                               class="file-download-link">
                                📥 ${fileName}
                            </a>
                        </div>
                    </div>
                    `;
                    }
                }

                // Остальная обработка ссылок (как было раньше)
                let icon = "🔗";
                let className = "message-link";
                let isImage = false;
                let displayText = match;

                if (imageExtensions.test(match)) {
                    isImage = true;
                    className = "message-image-link";

                    if (match.match(/^[a-zA-Z]:\\/) || match.startsWith('\\\\')) {
                        return `
                    <div class="local-image-container">
                        <div class="local-image-preview" onclick="window.openLocalImage('${match.replace(/'/g, "\\'")}')">
                            <span class="local-image-icon">🖼️</span>
                            <span class="local-image-name">${match.split('\\').pop()}</span>
                            <span class="local-image-path">${match}</span>
                        </div>
                    </div>
                    `;
                    }

                    if (isHttpUrl.test(match)) {
                        return `
                    <div class="image-container">
                        <img src="${match}" 
                             alt="Изображение" 
                             class="chat-image web-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"
                             onclick="window.openImageInNewTab('${match}')">
                        <div class="image-fallback" style="display: none;">
                            <span class="image-icon">🖼️</span>
                            <span class="image-path">${match}</span>
                        </div>
                    </div>
                    `;
                    }
                }

                if (match.startsWith('\\\\')) {
                    icon = "💻";
                    className = "message-link network-path";
                } else if (match.match(/^[a-zA-Z]:\\/)) {
                    icon = "📁";
                    className = "message-link local-path";
                } else if (match.startsWith('www.')) {
                    displayText = `http://${match}`;
                    icon = "🌐";
                    className = "message-link web-url";
                } else if (match.startsWith('http')) {
                    icon = "🌐";
                    className = "message-link web-url";
                }

                return ` <span class="${className}" data-url="${displayText}" data-original="${match}">${icon} ${match}</span> `;
            });

            result += formattedText;
        }

        return result;
    };

    const normalizeMessage = (msg) => {
        const fixEncoding = (text) => {
            if (typeof text !== 'string') return '';
            return text.normalize('NFC');
        };

        const normalizeId = (id) => {
            if (id === null || id === undefined) return null;
            if (typeof id === 'number') return id;
            if (typeof id === 'string') {
                const num = parseInt(id);
                return isNaN(num) ? id : num;
            }
            return id;
        };

        const message = {
            messageId: normalizeId(msg.MessageId || msg.messageId || msg.id || Date.now() + Math.random()),
            senderId: normalizeId(msg.SenderId || msg.senderId),
            receiverId: normalizeId(msg.ReceiverId || msg.receiverId),
            messageText: fixEncoding(msg.MessageText || msg.messageText || msg.text || msg.content || msg || ''),
            timestamp: msg.Timestamp ? new Date(msg.Timestamp) : (msg.timestamp ? new Date(msg.timestamp) : new Date()),
            sender: msg.Sender || msg.sender || { displayName: 'Неизвестный' },
            receiver: msg.Receiver || msg.receiver || { displayName: 'Неизвестный' },
            isForwarded: msg.IsForwarded || msg.isForwarded || false,
            originalSender: msg.OriginalSender || msg.originalSender || null,
            isEdited: msg.IsEdited || msg.isEdited || false,
            editedTimestamp: msg.EditedTimestamp ? new Date(msg.EditedTimestamp) : null,
            isDeleted: msg.IsDeleted || msg.isDeleted || false,
            fileInfo: msg.FileInfo || null
        };

        // Проверяем, является ли сообщение файловым (JSON)
        try {
            const parsed = JSON.parse(message.messageText);
            if (parsed.type === 'file') {
                message.isFileMessage = true;
                message.fileData = parsed;
                message.formattedText = formatFileMessage(parsed);
            } else {
                message.formattedText = detectAndFormatLinks(message.messageText, message.fileInfo);
            }
        } catch {
            // Если не JSON, обрабатываем как обычное сообщение
            message.formattedText = detectAndFormatLinks(message.messageText, message.fileInfo);
        }

        return message;
    };

    const formatFileMessage = (fileData) => {
        const { originalName, fileUrl, fileSize, isImage, text } = fileData;
        const sizeFormatted = formatFileSize(fileSize);

        let fileHtml = '';

        if (isImage) {
            fileHtml = `
            <div class="uploaded-file image-file">
                <img src="${fileUrl}" 
                     alt="${originalName}"
                     class="file-preview"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"
                     onclick="window.openFileInViewer('${fileUrl}', '${originalName}')">
                <div class="image-fallback" style="display: none;">
                    <span class="image-icon">🖼️</span>
                    <span class="image-name">${originalName}</span>
                </div>
                <div class="file-info">
                    <a href="${fileUrl}" 
                       download="${originalName}"
                       class="file-download-link"
                       onclick="event.stopPropagation()">
                        📥 ${originalName} (${sizeFormatted})
                    </a>
                </div>
            </div>
        `;
        } else {
            fileHtml = `
            <div class="uploaded-file">
                <div class="file-icon">📄</div>
                <div class="file-info">
                    <a href="${fileUrl}" 
                       download="${originalName}"
                       class="file-download-link">
                        📥 ${originalName} (${sizeFormatted})
                    </a>
                </div>
            </div>
        `;
        }

        // Добавляем текстовое сообщение если есть
        if (text && text.trim()) {
            return `${detectAndFormatLinks(text)}<br/>${fileHtml}`;
        }

        return fileHtml;
    };

    const handleLinkClick = (e) => {
        const target = e.target;
        if (target.classList.contains('file-preview')) {
            e.preventDefault();
            const src = target.getAttribute('src');
            const alt = target.getAttribute('alt');
            window.openFileInViewer(src, alt);
            return;
        }

        if (target.classList.contains('chat-image')) {
            e.preventDefault();
            const src = target.getAttribute('src');
            if (src.startsWith('http')) {
                window.openImageInNewTab(src);
            }
            return;
        }

        const linkTarget = target.closest('.message-link');
        if (!linkTarget) return;

        e.preventDefault();
        const url = linkTarget.getAttribute('data-url');
        if (url.startsWith('http')) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const uploadFileToServer = async (file) => {
        if (!connection || !selectedUser) return;

        if (connection.state !== 'Connected') {
            console.error('Соединение не установлено');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // СОЗДАЕМ ПРЕВЬЮ И BLOB URL ДО ТОГО КАК ИСПОЛЬЗОВАТЬ ФАЙЛ
            let imagePreviewUrl = null;
            let fileBlobUrl = null;

            if (file.type.startsWith('image/')) {
                imagePreviewUrl = URL.createObjectURL(file);
            }

            // Создаем Blob URL для скачивания
            fileBlobUrl = URL.createObjectURL(file);

            // Сохраняем размер ДО использования файла
            const fileSize = file.size;

            // Теперь используем файл для сохранения
            const handle = await window.showSaveFilePicker({
                suggestedName: file.name,
                types: [{
                    description: 'Files',
                    accept: {
                        [file.type]: file.type.includes('/') ?
                            [`.${file.type.split('/')[1]}`] :
                            ['.bin']
                    }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(await file.arrayBuffer());
            await writable.close();

            const fileMessage = {
                type: 'file',
                originalName: file.name,
                fileUrl: fileBlobUrl,
                fileSize: fileSize, // Используем сохраненный размер
                text: message,
                isImage: file.type.startsWith('image/'),
                previewUrl: imagePreviewUrl
            };

            if (connection.state === 'Connected') {
                await connection.invoke('SendMessage', selectedUser.userId, JSON.stringify(fileMessage));
                setMessageText('');
            } else {
                throw new Error('Соединение прервано');
            }

        } catch (error) {
            console.error('Ошибка загрузки файла:', error);

            if (connection.state === 'Connected') {
                await connection.invoke('SendMessage', selectedUser.userId,
                    `${message ? message + '\n' : ''}📎 Файл: ${file.name} (${formatFileSize(file.size)})`);
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер: 10MB');
            return;
        }

        uploadFileToServer(file);
        e.target.value = '';
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const insertFileLink = () => {
        const filePath = prompt('Введите путь к файлу или пастке:');
        if (filePath) {
            setMessageText(prev => prev ? `${prev} ${filePath}` : filePath);
        }
    };

    const insertNetworkLink = () => {
        const url = prompt('Введите URL ссылку:');
        if (url) {
            setMessageText(prev => prev ? `${prev} ${url}` : url);
        }
    };

    // Функция для вставки изображения из буфера обмена
    const pasteImageFromClipboard = async () => {
        try {
            // Проверяем поддержку API буфера обмена
            if (!navigator.clipboard || !navigator.clipboard.read) {
                alert('Вставка из буфера обмена не поддерживается в вашем браузере');
                return;
            }

            // Получаем разрешение на доступ к буферу обмена
            const permissionStatus = await navigator.permissions.query({
                name: 'clipboard-read'
            });

            if (permissionStatus.state === 'denied') {
                alert('Доступ к буферу обмена запрещен. Разрешите доступ в настройках браузера.');
                return;
            }

            // Читаем содержимое буфера обмена
            const clipboardItems = await navigator.clipboard.read();

            for (const clipboardItem of clipboardItems) {
                // Ищем изображения в буфере обмена
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);

                        // Создаем файл из blob
                        const file = new File([blob], 'clipboard-image.png', {
                            type: blob.type,
                            lastModified: Date.now()
                        });

                        // Загружаем файл
                        uploadFileToServer(file);
                        return;
                    }
                }
            }

            // Если изображений не найдено
            alert('В буфере обмена нет изображений');
        } catch (error) {
            console.error('Ошибка при вставке из буфера обмена:', error);
            alert('Не удалось вставить изображение из буфера обмена: ' + error.message);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const file = files[0];
            if (file.size <= 10 * 1024 * 1024) {
                uploadFileToServer(file);
            } else {
                alert('Файл слишком большой. Максимальный размер: 10MB');
            }
        }
    };

    // Обработчик вставки через Ctrl+V
    const handlePaste = async (e) => {
        // Проверяем, есть ли изображения в буфере обмена
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = items[i].getAsFile();

                    if (blob) {
                        const file = new File([blob], 'pasted-image.png', {
                            type: blob.type,
                            lastModified: Date.now()
                        });

                        uploadFileToServer(file);
                    }
                    return;
                }
            }
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || !selectedUser || !connection) return;

        try {
            await connection.invoke('SendMessage', selectedUser.userId, message);
            setMessageText('');

            const textarea = document.querySelector('textarea');
            if (textarea) {
                textarea.style.height = 'auto';
            }
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
        }
    };

    const formatTime = (timestamp) => {
        try {
            if (!timestamp) return '--:--';
            const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
            if (isNaN(date.getTime())) return '--:--';
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '--:--';
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('ru-RU');
    };

    const selectUser = async (user) => {
        setSelectedUser(user);
        await loadMessageHistory(user.userId);
    };

    const reconnect = async () => {
        if (connection) {
            try {
                await connection.start();
                setConnectionStatus('Connected');
                await loadUsers();
                await getCurrentUser();
            } catch (error) {
                console.error('Ошибка переподключения:', error);
            }
        }
    };

    return (
        <div className="App">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {contextMenu.visible && (
                <div
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.message?.senderId === currentUser?.userId && (
                        <>
                            <div className="context-menu-item" onClick={editMessage}>
                                ✏️ Редактировать
                            </div>
                            <div className="context-menu-item" onClick={() => deleteMessage(contextMenu.message.messageId)}>
                                🗑️ Удалить
                            </div>
                        </>
                    )}
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            setForwardDialog({
                                visible: true,
                                comment: '',
                                multiple: false
                            });
                        }}
                    >
                        📤 Переслать
                    </div>
                    <div className="context-menu-item" onClick={() => {
                        navigator.clipboard.writeText(contextMenu.message?.messageText || '');
                        setContextMenu({ visible: false, x: 0, y: 0, message: null });
                    }}>
                        📋 Копировать текст
                    </div>
                </div>
            )}

            {forwardDialog.visible && (
                <div className="modal-overlay" onClick={() => setForwardDialog({ visible: false, comment: '', multiple: false })}>
                    <div className="path-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>📤 Переслать сообщение{forwardDialog.multiple && ' (несколько)'}</h3>
                        <div className="path-content">
                            {forwardDialog.multiple ? (
                                <>
                                    <strong>Количество:</strong> {selectedMessages.size} сообщений
                                    <br />
                                    <strong>От:</strong> Вы
                                </>
                            ) : (
                                <>
                                    <strong>От:</strong> {contextMenu.message?.sender?.displayName}
                                    <br />
                                    <strong>Текст:</strong> {contextMenu.message?.messageText?.substring(0, 100)}
                                    {contextMenu.message?.messageText?.length > 100 ? '...' : ''}
                                </>
                            )}
                        </div>

                        <div style={{ margin: '15px 0' }}>
                            <input
                                type="text"
                                placeholder="Добавить комментарий (необязательно)"
                                value={forwardDialog.comment}
                                onChange={(e) => setForwardDialog(prev => ({ ...prev, comment: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>

                        <div style={{ maxHeight: '200px', overflowY: 'auto', margin: '10px 0' }}>
                            {users
                                .filter(user => user.userId !== currentUser?.userId)
                                .map(user => (
                                    <div
                                        key={user.userId}
                                        style={{
                                            padding: '8px',
                                            borderBottom: '1px solid #eee',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}
                                        onClick={() => forwardMessage(user.userId, forwardDialog.comment)}
                                    >
                                        <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '12px' }}>
                                            {user.displayName?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{user.displayName}</div>
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                {user.isOnline ? 'Online' : 'Offline'}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>

                        <div className="modal-buttons">
                            <button
                                className="modal-button close-button"
                                onClick={() => setForwardDialog({ visible: false, comment: '', multiple: false })}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="chat-container">
                <div className="users-sidebar">
                    <div className="sidebar-header">
                        <h2>Чаты</h2>

                        {/* Поле поиска */}
                        <div className="search-input-wrapper">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Поиск пользователей..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="clear-search-btn"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="current-user">
                            {currentUser && (
                                <div className="current-user-info">
                                    <div className="user-avatar">
                                        {currentUser.displayName?.charAt(0) || 'U'}
                                    </div>
                                    <div className="user-details">
                                        <div className="user-name">{currentUser.displayName}</div>
                                        <div className="user-status">
                                            <span className={`status-dot ${currentUser.isOnline ? 'online' : 'offline'}`}></span>
                                            {currentUser.isOnline ? 'Online' : 'Offline'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Показываем результаты поиска или список пользователей */}
                    {searchTerm ? (
                        <div className="search-results">
                            <div className="search-results-header">
                                <h4>Результаты поиска</h4>
                                <span className="results-count">
                                    {searchResults.length} найдено
                                </span>
                            </div>

                            {isSearching ? (
                                <div className="search-loading">
                                    <div className="loading-spinner"></div>
                                    Поиск...
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="search-results-list">
                                    {searchResults.map(user => (
                                        <div
                                            key={user.userId}
                                            className="search-result-item"
                                            onClick={() => {
                                                selectUser(user);
                                                setSearchTerm('');
                                                setSearchResults([]);
                                            }}
                                        >
                                            <div className="user-avatar">
                                                {user.displayName?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                            <div className="user-info">
                                                <div className="user-name">{user.displayName}</div>
                                                <div className="user-windowsname">{user.windowsUsername}</div>
                                            </div>
                                            <div className="user-status">
                                                <div className={`status-dot ${user.isOnline ? 'online' : 'offline'}`}></div>
                                                <span>{user.isOnline ? 'Online' : 'Offline'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="search-empty">
                                    <div className="empty-icon">🔍</div>
                                    <p>Пользователи не найдены</p>
                                    <small>Попробуйте изменить запрос</small>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="users-list">
                            {users.filter(user => user.userId !== currentUser?.userId).map(user => (
                                <div
                                    key={user.userId}
                                    className={`user-item ${selectedUser?.userId === user.userId ? 'selected' : ''}`}
                                    onClick={() => selectUser(user)}
                                >
                                    <div className="user-avatar">
                                        {user.displayName?.charAt(0) || 'U'}
                                    </div>
                                    <div className="user-info">
                                        <div className="user-name">{user.displayName}</div>
                                        <div className="user-status">
                                            <span className={`status-dot ${user.isOnline ? 'online' : 'offline'}`}></span>
                                            {user.isOnline ? 'Online' : formatDate(user.lastSeen)}
                                        </div>
                                    </div>
                                    {user.isOnline && <div className="online-indicator"></div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="chat-main">
                    {selectedUser ? (
                        <>
                            <div className="chat-header">
                                <div className="header-left">
                                    <div className="chat-user-avatar">
                                        {selectedUser.displayName?.charAt(0) || 'U'}
                                    </div>
                                    <div className="header-info">
                                        <div className="chat-title">{selectedUser.displayName}</div>
                                        <div className="user-status">
                                            <span className={`status-dot ${selectedUser.isOnline ? 'online' : 'offline'}`}></span>
                                            {selectedUser.isOnline ? 'Online' : `Был(а) ${formatDate(selectedUser.lastSeen)}`}
                                        </div>
                                    </div>
                                </div>

                                <div className="header-right">
                                    {isMultiSelectMode && selectedMessages.size > 0 && (
                                        <div className="multi-select-actions">
                                            <span className="selected-count">
                                                Выбрано: {selectedMessages.size}
                                            </span>
                                            <button
                                                onClick={() => setForwardDialog({ visible: true, comment: '', multiple: true })}
                                                className="multi-action-btn"
                                                title="Переслать выбранные"
                                            >
                                                📤
                                            </button>
                                            <button
                                                onClick={deleteSelectedMessages}
                                                className="multi-action-btn delete"
                                                title="Удалить выбранные"
                                            >
                                                🗑️
                                            </button>
                                            <button
                                                onClick={selectAllMessages}
                                                className="multi-action-btn"
                                                title="Выбрать все"
                                            >
                                                ☑️
                                            </button>
                                            <button
                                                onClick={clearSelection}
                                                className="multi-action-btn"
                                                title="Очистить выбор"
                                            >
                                                ❌
                                            </button>
                                            <button
                                                onClick={() => setIsMultiSelectMode(false)}
                                                className="multi-action-btn"
                                                title="Выйти из режима выбора"
                                            >
                                                ←
                                            </button>
                                        </div>
                                    )}

                                    {!isMultiSelectMode && (
                                        <button
                                            onClick={() => setIsMultiSelectMode(true)}
                                            className="multi-select-toggle"
                                            title="Режим выбора сообщений"
                                        >
                                            ☑️
                                        </button>
                                    )}

                                    <div className="connection-status">
                                        <span className={`status-dot ${connectionStatus.toLowerCase()}`}></span>
                                        {connectionStatus}
                                        {connectionStatus !== 'Connected' && (
                                            <button onClick={reconnect} className="reconnect-btn">
                                                ↻
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="chat-messages" onClick={handleLinkClick}>
                                {messages.length === 0 ? (
                                    <div className="empty-chat">
                                        <div className="empty-icon">💬</div>
                                        <p>Нет сообщений</p>
                                        <small>Начните общение первым!</small>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => (
                                        <div
                                            key={msg.messageId || index}
                                            className={`message ${msg.senderId === currentUser?.userId ? 'own' : 'other'} ${msg.isForwarded ? 'message-forwarded' : ''
                                                } ${isMultiSelectMode ? 'selectable' : ''} ${selectedMessages.has(msg.messageId.toString()) ? 'selected' : ''}`}
                                            onContextMenu={(e) => handleContextMenu(e, msg)}
                                            onClick={(e) => {
                                                if (isMultiSelectMode) {
                                                    e.stopPropagation();
                                                    toggleMessageSelection(msg.messageId);
                                                }
                                            }}
                                        >
                                            {isMultiSelectMode && (
                                                <div className="message-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMessages.has(msg.messageId.toString())}
                                                        onChange={() => toggleMessageSelection(msg.messageId)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
                                            {msg.isForwarded && (
                                                <div className="message-forwarded-indicator">
                                                    ↪️ Переслано от {msg.originalSender}
                                                </div>
                                            )}
                                            <div className="message-avatar">
                                                {msg.sender?.displayName?.charAt(0) || 'U'}
                                            </div>
                                            <div className="message-content">
                                                <div className="message-header">
                                                    <span className="message-sender">{msg.sender?.displayName}</span>
                                                    <span className="message-time">
                                                        {formatTime(msg.timestamp)}
                                                        {msg.isEdited && ' (ред.)'}
                                                    </span>
                                                </div>
                                                <div
                                                    className="message-text"
                                                    dangerouslySetInnerHTML={{ __html: msg.formattedText }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={editingMessage ? sendEditedMessage : sendMessage} className="message-form">
                                {editingMessage && (
                                    <div className="edit-mode-indicator">
                                        <div className="edit-mode-content">
                                            <span>✏️ Редактирование сообщения</span>
                                            <div className="edit-mode-buttons">
                                                <button
                                                    type="button"
                                                    onClick={cancelEdit}
                                                    className="cancel-edit-btn"
                                                    title="Отменить редактирование"
                                                >
                                                    ❌
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={!message.trim() || message === originalMessage}
                                                    className="confirm-edit-btn"
                                                    title="Сохранить изменения"
                                                >
                                                    ✅
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="input-container">
                                    <div className="message-toolbar">
                                        <button
                                            type="button"
                                            onClick={insertFileLink}
                                            className="toolbar-btn"
                                            title="Вставить сетевой путь"
                                            disabled={!!editingMessage}
                                        >
                                            📁
                                        </button>
                                        <button
                                            type="button"
                                            onClick={insertNetworkLink}
                                            className="toolbar-btn"
                                            title="Вставить URL ссылку"
                                            disabled={!!editingMessage}
                                        >
                                            🔗
                                        </button>
                                        <button
                                            type="button"
                                            onClick={triggerFileInput}
                                            className="toolbar-btn"
                                            title="Загрузить файл на сервер"
                                            disabled={isUploading || !!editingMessage}
                                        >
                                            {isUploading ? '⏳' : '📎'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={pasteImageFromClipboard}
                                            className="toolbar-btn"
                                            title="Вставить изображение из буфера обмена"
                                            disabled={isUploading || !!editingMessage || !clipboardPermission}
                                        >
                                            📋
                                        </button>
                                    </div>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        placeholder={editingMessage ? "Редактирование сообщения..." : "Введите сообщение или перетащите файл..."}
                                        rows="1"
                                        disabled={connectionStatus !== 'Connected' || !selectedUser}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (editingMessage) {
                                                    sendEditedMessage(e);
                                                } else {
                                                    sendMessage(e);
                                                }
                                            }
                                            if (e.key === 'Escape' && editingMessage) {
                                                cancelEdit();
                                            }
                                        }}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onPaste={handlePaste}
                                        className={isDragging ? 'dragging' : ''}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!message.trim() || connectionStatus !== 'Connected' || !selectedUser || (editingMessage && message === originalMessage)}
                                        className="send-button"
                                        title={editingMessage ? "Сохранить изменения" : "Отправить сообщение"}
                                    >
                                        {editingMessage ? (
                                            "✅"
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {editingMessage && (
                                    <div className="mobile-cancel-edit">
                                        <button
                                            type="button"
                                            onClick={cancelEdit}
                                            className="mobile-cancel-btn"
                                        >
                                            Отменить редактирование
                                        </button>
                                    </div>
                                )}

                                {isUploading && (
                                    <div className="upload-progress">
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                        <span>Загрузка: {uploadProgress}%</span>
                                    </div>
                                )}
                                <div className="path-examples">
                                    <small>Примеры: \\server\share\folder или C:\Files\file.txt</small>
                                    <br />
                                    <small>Также можно вставлять изображения через Ctrl+V или кнопку 📋</small>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="no-chat-selected">
                            <div className="welcome-message">
                                <div className="welcome-icon">👋</div>
                                <h2>Добро пожаловать в чат!</h2>
                                <p>Выберите собеседника из списка слева чтобы начать общение</p>
                                <div className="network-info">
                                    <h4>📁 Сетевые возможности:</h4>
                                    <ul>
                                        <li>Вставляйте сетевые пути: \\server\share\folder</li>
                                        <li>Локальные пути: C:\Files\document.txt</li>
                                        <li>URL ссылки: https://example.com</li>
                                        <li>Перетаскивайте файлы прямо в чат</li>
                                        <li>Нажмите на ссылку для открытия в проводнике</li>
                                        <li>Используйте кнопки 📁 и 🔗 для быстрой вставки</li>
                                        <li>Загружайте файлы на сервер кнопкой 📎</li>
                                        <li>Вставляйте изображения из буфера обмена кнопкой 📋 или Ctrl+V</li>
                                        <li>Новый режим множественного выбора: нажмите ☑️ для выбора нескольких сообщений</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;