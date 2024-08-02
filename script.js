import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where, updateDoc, arrayUnion, arrayRemove, doc, getDoc, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAcw63opkkCEr44dafnWMGf-7N9tzVepxE",
    authDomain: "login-page-e09ea.firebaseapp.com",
    projectId: "login-page-e09ea",
    storageBucket: "login-page-e09ea.appspot.com",
    messagingSenderId: "966052546550",
    appId: "1:966052546550:web:c2db5ee2b2222e6a25a9d7",
    measurementId: "G-H36NM4MTRF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const songListDiv = document.getElementById('songList');
    const songsUl = document.getElementById('songs');
    const loginContainer = document.querySelector('.login-container');
    const instructionText = document.querySelector('.instruction');
    let currentUsername = '';

    const chatContainer = document.getElementById('chatContainer');
    const chatMessages = document.getElementById('chatMessages');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const instagramUrl = document.getElementById('instagramUrl').value;
        const password = document.getElementById('password').value;
        const username = extractUsername(instagramUrl);

        if (username) {
            try {
                const userExists = await checkUserExists(instagramUrl, password);
                if (userExists) {
                    currentUsername = username;
                    showUserContent(username);
                } else {
                    const urlExistsWithDifferentPassword = await checkUrlWithDifferentPassword(instagramUrl, password);
                    if (urlExistsWithDifferentPassword) {
                        alert('Ten URL został już zarejestrowany z innym hasłem.');
                    } else {
                        await registerUser(instagramUrl, password);
                        currentUsername = username;
                        showUserContent(username);
                    }
                }
            } catch (error) {
                console.error('Error during registration or login:', error);
            }
        } else {
            alert('Nieprawidłowy link do profilu na Instagramie.');
        }
    });

    function extractUsername(url) {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/);
        return match ? match[1] : null;
    }

    async function checkUserExists(instagramUrl, password) {
        const osobyRef = collection(db, 'osoby');
        const q = query(osobyRef, where('instagramUrl', '==', instagramUrl), where('password', '==', password));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    }

    async function checkUrlWithDifferentPassword(instagramUrl, password) {
        const osobyRef = collection(db, 'osoby');
        const q = query(osobyRef, where('instagramUrl', '==', instagramUrl));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            return data.password !== password;
        }
        return false;
    }

    async function registerUser(instagramUrl, password) {
        const osobyRef = collection(db, 'osoby');
        await addDoc(osobyRef, { instagramUrl, password });
    }

    async function showUserContent(username) {
        instructionText.textContent = `Witaj, ${username}!`;
        loginContainer.style.display = 'none';
        songListDiv.classList.remove('hidden');
        chatContainer.classList.remove('hidden');
        loadSongs();
        loadChatMessages();
    }

    function extractTitleFromUrl(url) {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/music\/([\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]+)/);
        if (match) {
            let title = match[1].replace(/-/g, ' ');  // Zamiana myślników na spacje
            title = title.replace(/\s+\d+$/, ''); // Usunięcie numerków na końcu
            console.log("Extracted title:", title); // Logowanie tytułu
            return title;
        }
        return 'Unknown Title';
    }

    async function loadSongs() {
        try {
            const songsRef = collection(db, 'songs');
            const songSnapshot = await getDocs(songsRef);
            const songs = songSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            songsUl.innerHTML = '';
            for (const song of songs) {
                const thumbnailUrl = song.thumbnail || ''; 
                const title = song.title || extractTitleFromUrl(song.tiktokUrl);
                console.log("Song title:", title); // Logowanie tytułu piosenki
                const audioUrl = song.audioUrl || ''; // Pobieranie URL do pliku MP3
                const registeredUsers = song.registeredUsers || [];
                const userIsRegistered = registeredUsers.includes(currentUsername);

                const li = document.createElement('li');
                li.innerHTML = `
                    <img src="${thumbnailUrl}" alt="${title} thumbnail" data-url="${song.tiktokUrl}">
                    <span>${title}</span>
                    <audio controls>
                        <source src="${audioUrl}" type="audio/mpeg">
                        Your browser does not support the audio element.
                    </audio>
                    <span class="users">${registeredUsers.join(', ')}</span>
                    <button class="add-user-btn" data-id="${song.id}" data-state="${userIsRegistered ? 'remove' : 'add'}">
                        ${userIsRegistered ? '-' : '+'}
                    </button>
                `;
                songsUl.appendChild(li);
            }

            // Dodanie event listenerów do miniatur i przycisków
            const addUserButtons = document.querySelectorAll('.add-user-btn');
            addUserButtons.forEach(button => {
                button.addEventListener('click', handleAddUserClick);
            });

            const thumbnails = document.querySelectorAll('#songs li img');
            thumbnails.forEach(thumbnail => {
                thumbnail.addEventListener('click', (e) => {
                    const tiktokUrl = e.target.dataset.url;
                    if (tiktokUrl) {
                        window.open(tiktokUrl, '_blank');
                    }
                });
            });

            // Dodanie event listenera do odtwarzacza audio
            const audios = document.querySelectorAll('#songs li audio');
            audios.forEach(audio => {
                audio.addEventListener('play', (e) => {
                    // Usunięcie klasy aktywnej z innych elementów
                    document.querySelectorAll('#songs li').forEach(li => li.classList.remove('active'));
                    document.querySelectorAll('#songs li img').forEach(img => img.classList.remove('playing'));

                    // Dodanie klasy aktywnej do aktualnie odtwarzanej piosenki
                    const li = e.target.closest('li');
                    if (li) {
                        li.classList.add('active');
                        const img = li.querySelector('img');
                        if (img) {
                            img.classList.add('playing');
                        }
                    }
                });

                audio.addEventListener('pause', (e) => {
                    // Usunięcie klasy 'playing' gdy audio jest pauzowane
                    const li = e.target.closest('li');
                    if (li) {
                        const img = li.querySelector('img');
                        if (img) {
                            img.classList.remove('playing');
                        }
                    }
                });

                audio.addEventListener('ended', (e) => {
                    // Usunięcie klasy 'playing' gdy audio się zakończy
                    const li = e.target.closest('li');
                    if (li) {
                        const img = li.querySelector('img');
                        if (img) {
                            img.classList.remove('playing');
                        }
                    }
                });
            });

            // Intersection Observer dla efektu powiększenia kafelka
            const songItems = document.querySelectorAll('#songs li');

            const handleIntersection = (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                    } else {
                        entry.target.classList.remove('active');
                    }
                });
            };

            const observer = new IntersectionObserver(handleIntersection, {
                root: null,
                rootMargin: '0px',
                threshold: 0.3
            });

            songItems.forEach(item => observer.observe(item));

        } catch (error) {
            console.error('Error loading songs:', error);
        }
    }

    async function handleAddUserClick(e) {
        const button = e.target;
        const songId = button.dataset.id;
        const action = button.dataset.state;

        try {
            const songRef = doc(db, 'songs', songId);
            if (action === 'add') {
                await updateDoc(songRef, {
                    registeredUsers: arrayUnion(currentUsername)
                });
                button.dataset.state = 'remove';
                button.textContent = '-';
            } else {
                await updateDoc(songRef, {
                    registeredUsers: arrayRemove(currentUsername)
                });
                button.dataset.state = 'add';
                button.textContent = '+';
            }
        } catch (error) {
            console.error('Error updating song users:', error);
        }
    }

    async function loadChatMessages() {
        try {
            const chatRef = collection(db, 'chatMessages');
            const q = query(chatRef, orderBy('timestamp', 'asc'));

            onSnapshot(q, (snapshot) => {
                chatMessages.innerHTML = '';
                snapshot.forEach((doc) => {
                    const message = doc.data();
                    const messageElement = document.createElement('div');
                    messageElement.textContent = `${message.username}: ${message.text}`;
                    chatMessages.appendChild(messageElement);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });

            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const messageText = chatInput.value.trim();
                if (messageText) {
                    try {
                        await addDoc(chatRef, {
                            username: currentUsername,
                            text: messageText,
                            timestamp: new Date()
                        });
                        chatInput.value = '';
                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                }
            });

        } catch (error) {
            console.error('Error loading chat messages:', error);
        }
    }

    async function handleAddUserClick(e) {
        const button = e.target;
        const songId = button.dataset.id;
        const action = button.dataset.state;

        try {
            const songRef = doc(db, 'songs', songId);
            if (action === 'add') {
                await updateDoc(songRef, {
                    registeredUsers: arrayUnion(currentUsername)
                });
                button.dataset.state = 'remove';
                button.textContent = '-';
            } else {
                await updateDoc(songRef, {
                    registeredUsers: arrayRemove(currentUsername)
                });
                button.dataset.state = 'add';
                button.textContent = '+';
            }
            loadSongs();
        } catch (error) {
            console.error('Error updating song registration:', error);
        }
    }

    async function loadChatMessages() {
        const chatRef = collection(db, 'chat');
        const q = query(chatRef, orderBy('timestamp', 'asc'));
        onSnapshot(q, (querySnapshot) => {
            chatMessages.innerHTML = ''; // Wyczyść istniejące wiadomości
            querySnapshot.forEach((doc) => {
                const messageData = doc.data();
                displayMessage(messageData.username, messageData.message);
            });
        });
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (message) {
            try {
                const chatRef = collection(db, 'chat');
                await addDoc(chatRef, {
                    username: currentUsername,
                    message,
                    timestamp: new Date()
                });
                chatInput.value = '';
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    });

    function displayMessage(username, message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${username}: ${message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Przewiń na dół
    }
});
