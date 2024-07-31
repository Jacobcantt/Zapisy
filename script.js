import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where, updateDoc, arrayUnion, arrayRemove, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

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
        loadSongs();
    }

    function extractTitleFromUrl(url) {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/music\/([a-zA-Z0-9._-]+)/);
        if (match) {
            let title = match[1].replace(/-/g, ' ');  // Zamiana myślników na spacje
            title = title.replace(/\s+\d+$/, ''); // Usunięcie numerków na końcu
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
                const audioUrl = song.audioUrl || ''; // Pobieranie URL do pliku MP3
                const registeredUsers = song.registeredUsers || [];
                const userIsRegistered = registeredUsers.includes(currentUsername);

                const li = document.createElement('li');
                li.innerHTML = `
                    <a href="${song.tiktokUrl}" target="_blank">
                        <img src="${thumbnailUrl}" alt="${title} thumbnail">
                    </a>
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

            const addUserButtons = document.querySelectorAll('.add-user-btn');
            addUserButtons.forEach(button => {
                button.addEventListener('click', handleAddUserClick);
            });

            songListDiv.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading songs:', error);
        }
    }

    async function handleAddUserClick(event) {
        const songId = event.target.dataset.id;
        const songRef = doc(db, 'songs', songId);
        const songDoc = await getDoc(songRef);
        const songData = songDoc.data();
        const registeredUsers = songData.registeredUsers || [];

        if (registeredUsers.includes(currentUsername)) {
            await updateDoc(songRef, {
                registeredUsers: arrayRemove(currentUsername)
            });
        } else {
            await updateDoc(songRef, {
                registeredUsers: arrayUnion(currentUsername)
            });
        }
        loadSongs();
    }

    async function fetchThumbnailUrl(tiktokUrl) {
        try {
            const response = await fetch(`https://www.tiktok.com/oembed?url=${tiktokUrl}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data.thumbnail_url;
        } catch (error) {
            console.error('Error fetching TikTok details:', error);
            return null;
        }
    }

    async function updateSongsWithThumbnails() {
        const songsRef = collection(db, 'songs');
        const songSnapshot = await getDocs(songsRef);

        for (const doc of songSnapshot.docs) {
            const songData = doc.data();
            const thumbnailUrl = await fetchThumbnailUrl(songData.tiktokUrl);
            
            if (thumbnailUrl) {
                await updateDoc(doc.ref, { thumbnail: thumbnailUrl });
            }
        }
    }

    // Uncomment the following line if you need to update thumbnails manually
    // updateSongsWithThumbnails();
});
