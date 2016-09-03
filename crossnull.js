const socket = new WebSocket('ws://xo.t.javascript.ninja/games');
const listGames = document.querySelector('.listgames');
const buttonCreateGame = document.querySelector('input[name="create"]');
const table = document.querySelector('.table');
const messageFromServer = document.querySelector('.message');
const buttonNewGame = document.querySelector('input[name="message"]');
const tip = document.querySelector('.tip');
const myHeaders = new Headers();
let gameID;
let playerID;
let mySymbol;
let enemySymbol;

buttonNewGame.style.display = 'none';
table.style.display = 'none';

function createTable() {
  for (let i = 0; i < 10; i++) {
    const tr = document.createElement('tr');
    for (let j = 0; j < 10; j++) {
      const td = document.createElement('td');
      td.id = 10 * i + j + 1;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function createHeaders() {
  myHeaders.set('Content-Type', 'application/json');
  myHeaders.set('Game-ID', gameID);
  myHeaders.set('Player-ID', playerID);
}

function longPolling() {
  tip.innerHTML = 'Противник думает';
  table.classList.add('enemy');

  fetch('http://xo.t.javascript.ninja/move', { headers: myHeaders,
                                               method: 'get' })
    .then(response => response.json())
    .then(data => {
      if (data.move) {
        table.querySelector(`[id="${data.move}"]`).innerHTML = enemySymbol;
        tip.innerHTML = 'Ваш ход';
        table.classList.remove('enemy');
      }
      if (data.win) {
        messageFromServer.innerHTML = data.win;
        buttonNewGame.value = 'Новая игра';
        tip.innerHTML = '';
      }
    })
    .catch(() => longPolling());
}

function addGame(id) {
  const li = document.createElement('li');
  li.dataset.game = id;
  li.innerHTML = id;
  listGames.appendChild(li);
}

function removeGame(id) {
  listGames.removeChild(listGames.querySelector(`[data-game="${id}"]`));
}

buttonCreateGame.addEventListener('click', () => {
  buttonCreateGame.setAttribute('disabled', 'disabled');
  listGames.style.display = 'none';
  fetch('http://xo.t.javascript.ninja/newGame', { method: 'post' })
    .then(response => response.json())
    .then(data => {
      gameID = data.yourId;
      const reqToSocket = { register: gameID };
      socket.send(JSON.stringify(reqToSocket));
    })
    .catch(err => {
      buttonCreateGame.removeAttribute('disabled');
      messageFromServer.innerHTML = 'Ошибка создания игры';
    });
});

socket.addEventListener('open', () => console.log('socket open'));

socket.addEventListener('close', () => console.log('socket close'));

socket.addEventListener('error', err => console.log(`socket error: ${err}`));

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);

  switch (message.action) {
    case 'add':
      addGame(message.id);
      break;
    case 'remove':
      removeGame(message.id);
      break;
    case 'startGame':
      messageFromServer.innerHTML = 'Ожидаем начала игры';
      buttonCreateGame.setAttribute('disabled', 'disabled');
      playerID = message.id;
      const bodyRequest = JSON.stringify({ player: playerID, game: gameID });
      const header = new Headers();
      header.append('Content-Type', 'application/json');

      createHeaders();
      createTable();

      fetch('http://xo.t.javascript.ninja/gameReady', { method: 'post',
                                                        headers: header,
                                                        body: bodyRequest })
        .then(res => {
          if (res.status === 410) messageFromServer.innerHTML = 'Ошибка старта игры: другой игрок не ответил';
          if (res.status !== 410 && res.status !== 200) messageFromServer.innerHTML = 'Неизвестная ошибка старта игры';
          return res.json();
        })
        .then(data => {
          mySymbol = data.side;
          enemySymbol = mySymbol === 'x' ? 'o' : 'x';
          table.style.display = 'table';
          table.classList.remove('enemy');
          buttonNewGame.value = 'Сдаться';
          buttonNewGame.style.display = 'inline-block';
          messageFromServer.innerHTML = `Наш символ - ${mySymbol}`;
          listGames.style.display = 'none';
          if (mySymbol === 'o') {
            longPolling();
          } else {
            tip.innerHTML = 'Ваш ход';
          }
        })
        .catch(err => {
          messageFromServer.innerHTML = err.message;
        });
      break;
  }
});

listGames.addEventListener('click', event => {
  gameID = event.target.dataset.game;
  console.log(gameID);
  buttonCreateGame.setAttribute('disabled', 'disabled');
  const reqToSocket = { register: gameID };
  socket.send(JSON.stringify(reqToSocket));
});

table.addEventListener('click', event => {
  const cell = event.target;
  const bodyReq = JSON.stringify({ move: cell.id });

  fetch('http://xo.t.javascript.ninja/move', { method: 'post', headers: myHeaders, body: bodyReq })
    .then(response => {
      if (response.status === 200) {
        cell.innerHTML = mySymbol;
        longPolling();
      }
      return response.json();
    })
    .then(data => {
      if (data.win) {
        messageFromServer.innerHTML = data.win;
        table.classList.add('enemy');
        buttonNewGame.value = 'Новая игра';
        tip.innerHTML = '';
      }
      if (data.message) messageFromServer.innerHTML = data.message;
    })
    .catch(err => {
      messageFromServer.innerHTML = 'Неизвестная ошибка';
    });
});

buttonNewGame.addEventListener('click', event => {
  if (buttonNewGame.value === 'Сдаться') {
    fetch('http://xo.t.javascript.ninja/surrender', { method: 'put', headers: myHeaders })
      .then(response => {
        if (response.status === 200) {
          table.innerHTML = '';
          table.style.display = 'none';
          buttonNewGame.style.display = 'none';
          listGames.style.display = 'block';
          buttonCreateGame.removeAttribute('disabled');
          messageFromServer.innerHTML = '';
          tip.innerHTML = 'Я сдался';
        }
        return response.json();
      })
      .then(data => {
        if (data.message) messageFromServer.innerHTML = data.message;
      })
    .catch(err => messageFromServer.innerHTML = 'Неизвестная ошибка');
  }

  if (buttonNewGame.value === 'Новая игра') {
    table.innerHTML = '';
    table.style.display = 'none';
    buttonNewGame.style.display = 'none';
    listGames.style.display = 'block';
    messageFromServer.innerHTML = '';
    buttonCreateGame.removeAttribute('disabled');
  }
});
