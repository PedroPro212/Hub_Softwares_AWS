import { pcDatabase } from './pcDatabase.js';

function populateGameOptions() {
    const select = document.getElementById('game');

    // Pegar todos os nomes de jogos do pcDatabase
    const games = Object.keys(pcDatabase);

    // Ordenar alfabeticamente
    games.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    // Criar os options
    games.forEach(game => {
        const option = document.createElement('option');
        option.value = game;
        option.textContent = pcDatabase[game].name || game; // pode usar name se quiser display diferente
        select.appendChild(option);
    });
}

// Chama ao carregar a página
window.addEventListener('DOMContentLoaded', populateGameOptions);

function toggleMenu() {
    document.getElementById('menu').classList.toggle('active');
}

async function fetchGameInfo(gameName) {
    // Mantemos a API só como fallback opcional
}

function showPCs() {
    const game = document.getElementById('game').value;
    if (!game) return alert("Selecione um jogo!");

    const base = pcDatabase[game].base;
    const ideal = pcDatabase[game].ideal;
    const gameImage = pcDatabase[game].image;
    const description = pcDatabase[game].description;
    const company = pcDatabase[game].company;
    const release = pcDatabase[game].release;

    const baseSpecs = document.getElementById('baseSpecs');
    const idealSpecs = document.getElementById('idealSpecs');

    baseSpecs.innerHTML = '';
    idealSpecs.innerHTML = '';

    for (let key in base) {
        const li = document.createElement('li');
        li.textContent = `${key}: ${base[key]}`;
        baseSpecs.appendChild(li);
    }
    for (let key in ideal) {
        const li = document.createElement('li');
        li.textContent = `${key}: ${ideal[key]}`;
        idealSpecs.appendChild(li);
    }

    // Mostrar informações do jogo
    document.getElementById('gameImage').src = gameImage;
    document.getElementById('gameTitle').textContent = game;
    document.getElementById('gameRelease').textContent = release;
    document.getElementById('gamePlatforms').textContent = company;
    document.getElementById('gameCompany').textContent = description;

    document.getElementById('pcResults').style.display = 'flex';
    document.getElementById('pcResults').scrollIntoView({ behavior: 'smooth' });

    document.getElementById('gameInfo').style.display = 'flex';
    document.getElementById('gameImage').style.display = 'block';
    document.getElementById('gameTitle').style.display = 'block';
    document.querySelector('.info-block').style.display = 'flex';
}

// Tornar global
window.showPCs = showPCs;
window.toggleMenu = toggleMenu;