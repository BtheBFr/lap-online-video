// Основные переменные
let localStream;
let remoteStream;
let peer;
let currentPeerId;
let roomId;
let screenStream = null;
let isCameraOn = true;
let isMicOn = true;
let isScreenSharing = false;
let isCameraFlipped = false;

// DOM элементы
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleCameraBtn = document.getElementById('toggleCamera');
const toggleMicBtn = document.getElementById('toggleMic');
const shareScreenBtn = document.getElementById('shareScreen');
const rotateCameraBtn = document.getElementById('rotateCamera');
const inviteBtn = document.getElementById('inviteBtn');
const endCallBtn = document.getElementById('endCall');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const roomNumber = document.getElementById('roomNumber');
const micStatus = document.getElementById('micStatus');
const cameraStatus = document.getElementById('cameraStatus');
const localStatus = document.getElementById('localStatus');
const remoteStatus = document.getElementById('remoteStatus');
const waitingMessage = document.getElementById('waitingMessage');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const inviteModal = document.getElementById('inviteModal');
const closeModal = document.getElementById('closeModal');
const inviteLink = document.getElementById('inviteLink');
const copyInviteLink = document.getElementById('copyInviteLink');
const p2pStatus = document.getElementById('p2pStatus');

// Инициализация при загрузке страницы
window.addEventListener('load', async () => {
    showNotification('Инициализация видеозвонка...');
    
    // Генерация ID комнаты из URL или создание нового
    roomId = getRoomIdFromUrl() || generateRoomId();
    roomNumber.textContent = roomId;
    
    // Обновление URL с ID комнаты
    updateUrlWithRoomId(roomId);
    
    // Инициализация Peer соединения
    await initPeerConnection();
    
    // Запуск локальной камеры
    await startLocalCamera();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    showNotification('Готово к видеозвонку! Отправьте ссылку собеседнику');
});

// Генерация ID комнаты
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Получение ID комнаты из URL
function getRoomIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
}

// Обновление URL с ID комнаты
function updateUrlWithRoomId(id) {
    const newUrl = window.location.origin + window.location.pathname + '?room=' + id;
    window.history.replaceState({}, document.title, newUrl);
    inviteLink.value = newUrl;
}

// Инициализация Peer соединения
async function initPeerConnection() {
    try {
        // Используем бесплатный PeerJS сервер
        peer = new Peer(roomId, {
            host: 'peerjs-server-production-b727.up.railway.app',
            port: 443,
            path: '/peerjs',
            secure: true,
            debug: 3
        });
            
        peer.on('open', (id) => {
            console.log('Peer соединение установлено. ID:', id);
            currentPeerId = id;
            p2pStatus.textContent = 'Подключено';
            p2pStatus.style.color = '#10b981';
            showNotification('P2P соединение готово');
        });
        
        peer.on('connection', (conn) => {
            console.log('Входящее соединение:', conn.peer);
        });
        
        peer.on('call', async (call) => {
            console.log('Входящий видеозвонок от:', call.peer);
            showNotification('Входящий видеозвонок...');
            
            // Отвечаем на звонок с локальным потоком
            call.answer(localStream);
            
            // Получаем удаленный поток
            call.on('stream', (stream) => {
                console.log('Получен удаленный видеопоток');
                remoteStream = stream;
                remoteVideo.srcObject = stream;
                remoteStatus.innerHTML = '<i class="fas fa-circle"></i> подключен';
                remoteStatus.style.color = '#10b981';
                waitingMessage.style.display = 'none';
                showNotification('Собеседник подключился!');
            });
            
            call.on('close', () => {
                console.log('Звонок завершен');
                handleCallEnd();
            });
            
            call.on('error', (err) => {
                console.error('Ошибка звонка:', err);
                showNotification('Ошибка соединения', 'error');
            });
        });
        
        peer.on('error', (err) => {
            console.error('Peer ошибка:', err);
            showNotification('Ошибка P2P соединения', 'error');
        });
        
        // Автоподключение при наличии roomId в URL (для второго участника)
        const urlRoomId = getRoomIdFromUrl();
        if (urlRoomId && urlRoomId !== roomId) {
            setTimeout(() => connectToPeer(urlRoomId), 2000);
        }
        
    } catch (error) {
        console.error('Ошибка инициализации Peer:', error);
        showNotification('Не удалось установить P2P соединение', 'error');
    }
}

// Подключение к другому пиру
async function connectToPeer(peerId) {
    if (!localStream) {
        await startLocalCamera();
    }
    
    try {
        showNotification('Подключение к собеседнику...');
        const call = peer.call(peerId, localStream);
        
        call.on('stream', (stream) => {
            console.log('Получен удаленный видеопоток');
            remoteStream = stream;
            remoteVideo.srcObject = stream;
            remoteStatus.innerHTML = '<i class="fas fa-circle"></i> подключен';
            remoteStatus.style.color = '#10b981';
            waitingMessage.style.display = 'none';
            showNotification('Соединение установлено!');
        });
        
        call.on('close', () => {
            console.log('Звонок завершен');
            handleCallEnd();
        });
        
        call.on('error', (err) => {
            console.error('Ошибка звонка:', err);
            showNotification('Ошибка подключения', 'error');
        });
        
    } catch (error) {
        console.error('Ошибка подключения:', error);
        showNotification('Не удалось подключиться', 'error');
    }
}

// Запуск локальной камеры
async function startLocalCamera() {
    try {
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        localStatus.innerHTML = '<i class="fas fa-circle"></i> онлайн';
        localStatus.style.color = '#10b981';
        
        console.log('Локальная камера активирована');
        return true;
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        showNotification('Не удалось получить доступ к камере', 'error');
        return false;
    }
}

// Обработчики событий
function setupEventListeners() {
    // Переключение камеры
    toggleCameraBtn.addEventListener('click', toggleCamera);
    
    // Переключение микрофона
    toggleMicBtn.addEventListener('click', toggleMicrophone);
    
    // Демонстрация экрана
    shareScreenBtn.addEventListener('click', toggleScreenShare);
    
    // Переворот камеры
    rotateCameraBtn.addEventListener('click', rotateCamera);
    
    // Приглашение
    inviteBtn.addEventListener('click', () => {
        inviteModal.classList.add('active');
    });
    
    // Завершение звонка
    endCallBtn.addEventListener('click', endCall);
    
    // Копирование ссылки на комнату
    copyRoomBtn.addEventListener('click', copyRoomLink);
    
    // Закрытие модального окна
    closeModal.addEventListener('click', () => {
        inviteModal.classList.remove('active');
    });
    
    // Копирование ссылки приглашения
    copyInviteLink.addEventListener('click', () => {
        copyToClipboard(inviteLink.value);
        showNotification('Ссылка скопирована в буфер обмена');
    });
    
    // Кнопки шаринга
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const platform = this.classList[1];
            shareLink(platform);
        });
    });
    
    // Клик вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target === inviteModal) {
            inviteModal.classList.remove('active');
        }
    });
}

// Переключение камеры
function toggleCamera() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isCameraOn = !isCameraOn;
        videoTrack.enabled = isCameraOn;
        
        const icon = toggleCameraBtn.querySelector('i');
        const text = toggleCameraBtn.querySelector('span');
        
        if (isCameraOn) {
            icon.className = 'fas fa-video';
            text.textContent = 'Выключить камеру';
            cameraStatus.textContent = 'вкл';
            cameraStatus.style.color = '#10b981';
            showNotification('Камера включена');
        } else {
            icon.className = 'fas fa-video-slash';
            text.textContent = 'Включить камеру';
            cameraStatus.textContent = 'выкл';
            cameraStatus.style.color = '#ef4444';
            showNotification('Камера выключена');
        }
    }
}

// Переключение микрофона
function toggleMicrophone() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isMicOn = !isMicOn;
        audioTrack.enabled = isMicOn;
        
        const icon = toggleMicBtn.querySelector('i');
        const text = toggleMicBtn.querySelector('span');
        
        if (isMicOn) {
            icon.className = 'fas fa-microphone';
            text.textContent = 'Выключить микрофон';
            micStatus.textContent = 'вкл';
            micStatus.style.color = '#10b981';
            showNotification('Микрофон включен');
        } else {
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Включить микрофон';
            micStatus.textContent = 'выкл';
            micStatus.style.color = '#ef4444';
            showNotification('Микрофон выключен');
        }
    }
}

// Демонстрация экрана
async function toggleScreenShare() {
    try {
        if (!isScreenSharing) {
            // Запрос на демонстрацию экрана
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Заменяем видеотрек в локальном потоке
            const videoTrack = screenStream.getVideoTracks()[0];
            const localVideoTrack = localStream.getVideoTracks()[0];
            
            localStream.removeTrack(localVideoTrack);
            localStream.addTrack(videoTrack);
            localVideo.srcObject = localStream;
            
            isScreenSharing = true;
            
            const icon = shareScreenBtn.querySelector('i');
            const text = shareScreenBtn.querySelector('span');
            icon.className = 'fas fa-stop-circle';
            text.textContent = 'Остановить демонстрацию';
            
            showNotification('Демонстрация экрана запущена');
            
            // Обработка остановки демонстрации экрана
            videoTrack.onended = () => {
                toggleScreenShare();
            };
            
        } else {
            // Возвращаем камеру
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }
            
            // Получаем поток с камеры
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            
            const cameraVideoTrack = cameraStream.getVideoTracks()[0];
            const currentVideoTrack = localStream.getVideoTracks()[0];
            
            localStream.removeTrack(currentVideoTrack);
            localStream.addTrack(cameraVideoTrack);
            localVideo.srcObject = localStream;
            
            isScreenSharing = false;
            
            const icon = shareScreenBtn.querySelector('i');
            const text = shareScreenBtn.querySelector('span');
            icon.className = 'fas fa-desktop';
            text.textContent = 'Поделиться экраном';
            
            showNotification('Демонстрация экрана остановлена');
        }
        
    } catch (error) {
        console.error('Ошибка демонстрации экрана:', error);
        showNotification('Не удалось начать демонстрацию экрана', 'error');
    }
}

// Переворот камеры
function rotateCamera() {
    isCameraFlipped = !isCameraFlipped;
    
    if (isCameraFlipped) {
        localVideo.classList.add('flipped');
        showNotification('Камера перевернута');
    } else {
        localVideo.classList.remove('flipped');
        showNotification('Камера в обычном режиме');
    }
}

// Завершение звонка
function endCall() {
    if (confirm('Завершить видеозвонок?')) {
        handleCallEnd();
        showNotification('Звонок завершен');
        
        // Останавливаем все медиапотоки
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        
        // Сбрасываем видео элементы
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
        
        // Перезагрузка страницы для нового звонка
        setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
        }, 2000);
    }
}

// Обработка завершения звонка
function handleCallEnd() {
    remoteVideo.srcObject = null;
    waitingMessage.style.display = 'block';
    remoteStatus.innerHTML = '<i class="fas fa-circle"></i> отключен';
    remoteStatus.style.color = '#ef4444';
}

// Копирование ссылки на комнату
function copyRoomLink() {
    copyToClipboard(window.location.href);
    showNotification('Ссылка на комнату скопирована');
}

// Копирование в буфер обмена
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Скопировано в буфер:', text);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

// Шаринг ссылки
function shareLink(platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('Присоединяйся к моему видеозвонку на Lap Video Online!');
    
    let shareUrl;
    
    switch(platform) {
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${text}%20${url}`;
            break;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=Приглашение на видеозвонок&body=${text}%0A%0A${url}`;
            break;
        default:
            return;
    }
    
    window.open(shareUrl, '_blank');
    inviteModal.classList.remove('active');
    showNotification(`Открывается ${platform}...`);
}

// Показать уведомление
function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    
    // Установка цвета в зависимости от типа
    if (type === 'error') {
        notification.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    } else if (type === 'warning') {
        notification.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    } else {
        notification.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
    }
    
    notification.classList.add('show');
    
    // Автоскрытие через 4 секунды
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// Обновление статусов
function updateStatusIndicators() {
    // Обновление статуса WebRTC
    const webrtcStatus = document.getElementById('webrtcStatus');
    const videoTechStatus = document.getElementById('videoTechStatus');
    
    if (typeof RTCPeerConnection !== 'undefined') {
        webrtcStatus.textContent = 'Поддерживается';
        webrtcStatus.style.color = '#10b981';
        videoTechStatus.textContent = 'WebRTC (P2P)';
    } else {
        webrtcStatus.textContent = 'Не поддерживается';
        webrtcStatus.style.color = '#ef4444';
        videoTechStatus.textContent = 'Резервный режим';
    }
}

// Инициализация статусов
updateStatusIndicators();

// Обработка закрытия страницы
window.addEventListener('beforeunload', (e) => {
    if (peer && peer.connections && Object.keys(peer.connections).length > 0) {
        e.preventDefault();
        e.returnValue = 'У вас активный видеозвонок. Вы уверены, что хотите уйти?';
    }
});
