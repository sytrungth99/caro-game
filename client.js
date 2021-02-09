(function init() {
  const P1 = 'X';
  const P2 = 'O';
  let player;
  let game;

  const socket = io.connect('http://localhost:5000');

  class Player {
    constructor(name, type) {
      this.name = name;
      this.type = type;
      this.currentTurn = true;
      this.playsArr = 0;
    }

    static get wins() {
      return [7, 56, 448, 73, 146, 292, 273, 84];
    }

    // Set the bit of the move played by the player
    // tileValue - Bitmask used to set the recently played move.
    updatePlaysArr(tileValue) {
      this.playsArr += tileValue;
    }

    getPlaysArr() {
      return this.playsArr;
    }

    // Set the currentTurn for player to turn and update UI to reflect the same.
    setCurrentTurn(turn) {
      this.currentTurn = turn;
      const message = turn ? 'Your turn' : 'Waiting for Opponent';
      $('#turn').text(message);
    }

    getPlayerName() {
      return this.name;
    }

    getPlayerType() {
      return this.type;
    }

    getCurrentTurn() {
      return this.currentTurn;
    }
  }

  // roomId Id of the room in which the game is running on the server.
  class Game {
    constructor(roomId) {
      this.roomId = roomId;
      this.board = [];
      this.moves = 0;
    }

    // Tạo bảng Trò chơi bằng cách gắn trình nghe sự kiện vào các nút.
    createGameBoard() {
      function tileClickHandler() {
        const row = parseInt(this.id.split('_')[1][0], 10);
        const col = parseInt(this.id.split('_')[1][1], 10);
        if (!player.getCurrentTurn() || !game) {
          alert('Its not your turn!');
          return;
        }

        if ($(this).prop('disabled')) {
          alert('This tile has already been played on!');
          return;
        }

        // Cập nhật bảng sau lượt của bạn.
        game.playTurn(this);
        game.updateBoard(player.getPlayerType(), row, col, this.id);

        player.setCurrentTurn(false);
        player.updatePlaysArr(1 << ((row * 3) + col));

        game.checkWinner();
      }

      for (let i = 0; i < 3; i++) {
        this.board.push(['', '', '']);
        for (let j = 0; j < 3; j++) {
          $(`#button_${i}${j}`).on('click', tileClickHandler);
        }
      }
    }
    // Remove the menu from DOM, display the gameboard and greet the player.
    displayBoard(message) {
      $('.menu').css('display', 'none');
      $('.gameBoard').css('display', 'block');
      $('#userHello').html(message);
      this.createGameBoard();
    }
    /**
     * Update game board UI
     *
     * @param {string} type Type of player(X or O)
     * @param {int} row Row in which move was played
     * @param {int} col Col in which move was played
     * @param {string} tile Id of the the that was clicked
     */
    updateBoard(type, row, col, tile) {
      $(`#${tile}`).text(type).prop('disabled', true);
      this.board[row][col] = type;
      this.moves++;
    }

    getRoomId() {
      return this.roomId;
    }

    // Send an update to the opponent to update their UI's tile
    playTurn(tile) {
      const clickedTile = $(tile).attr('id');

      // Tạo sự kiện để cập nhật người chơi khác mà bạn đã chơi lượt của mình
      socket.emit('playTurn', {
        tile: clickedTile,
        room: this.getRoomId(),
      });
    }

    checkWinner() {
      const currentPlayerPositions = player.getPlaysArr();

      Player.wins.forEach((winningPosition) => {
        if ((winningPosition & currentPlayerPositions) === winningPosition) {
          game.announceWinner();
        }
      });

      const tieMessage = 'Game Tied :(';
      if (this.checkTie()) {
        socket.emit('gameEnded', {
          room: this.getRoomId(),
          message: tieMessage,
        });
        alert(tieMessage);
        location.reload();
      }
    }

    checkTie() {
      return this.moves >= 9;
    }

    // Announce the winner if the current client has won. 
    // Broadcast this on the room to let the opponent know.
    announceWinner() {
      const message = `${player.getPlayerName()} wins!`;
      socket.emit('gameEnded', {
        room: this.getRoomId(),
        message,
      });
      alert(message);
      location.reload();
    }

    // End the game if the other player won.
    endGame(message) {
      alert(message);
      location.reload();
    }
  }

  // Tạo một game mới
  $('#new').on('click', () => {
    const name = $('#nameNew').val();
    if (!name) {
      alert('Please enter your name.');
      return;
    }
    socket.emit('createGame', { name });
    player = new Player(name, P1);
  });

  // Tham gia một trò chơi hiện có trên roomId đã nhập.
  $('#join').on('click', () => {
    const name = $('#nameJoin').val();
    const roomID = $('#room').val();
    if (!name || !roomID) {
      alert('Please enter your name and game ID.');
      return;
    }
    socket.emit('joinGame', { name, room: roomID });
    player = new Player(name, P2);
  });

  // Cập nhật giao diện người dùng và tạo trò chơi mới.
  socket.on('newGame', (data) => {
    const message =
      `Hello, ${data.name}. Yêu cầu bạn bè của bạn nhập ID trò chơi: 
      ${data.room}. Chờ người chơi 2...`;

    // Tạo game cho người chơi 1
    game = new Game(data.room);
    game.displayBoard(message);
  });

  /**
	 * Nếu người chơi tạo trò chơi, anh ta sẽ là P1 (X) và có lượt đầu tiên.
	 * Sự kiện này nhận được khi đối thủ kết nối với phòng.
	 */
  socket.on('player1', (data) => {
    const message = `Hello, ${player.getPlayerName()}`;
    $('#userHello').html(message);
    player.setCurrentTurn(true);
  });

  /**
	 * Đã tham gia trò chơi, vậy người chơi là P2 (O).
	 * Event này nhận được khi P2 tham gia phòng game thành công.
	 */
  socket.on('player2', (data) => {
    const message = `Hello, ${data.name}`;

    // Create game for player 2
    game = new Game(data.room);
    game.displayBoard(message);
    player.setCurrentTurn(false);
  });

  /**
	 * Đối thủ chơi đến lượt mình. Cập nhật giao diện người dùng.
	 * cập nhật giao diện 
	 */
  socket.on('turnPlayed', (data) => {
    const row = data.tile.split('_')[1][0];
    const col = data.tile.split('_')[1][1];
    const opponentType = player.getPlayerType() === P1 ? P2 : P1;

    game.updateBoard(opponentType, row, col, data.tile);
    player.setCurrentTurn(true);
  });

  // If the other player wins, this event is received. Notify user game has ended.
  socket.on('gameEnd', (data) => {
    game.endGame(data.message);
    socket.leave(data.room);
  });

  /**
	 * End the game on any err event. 
	 */
  socket.on('err', (data) => {
    game.endGame(data.message);
  });
  // create message
  const msgText = document.querySelector('#msg')
const btnSend = document.querySelector('#btn-send')
const chatBox = document.querySelector('.chat-content')
const displayMsg = document.querySelector('.message')


let name;
socket.on('newGame',(data) =>{
  name = data.name;
  console.log('name',data.name)
})
socket.on('player2',(data) =>{
  name = data.name;
  console.log('name',data.name)
})

msgText.focus()

btnSend.addEventListener('click',(e) =>{
    e.preventDefault()
    sendMsg(msgText.value)
    msgText.value = '';
    msgText.focus()
})
const sendMsg = message =>{
    let msg ={
        user:name,
        message:message.trim()
    }
    display(msg,'your-message')
    socket.emit('sendMessage',msg)//truyen giu lieu cho server
}
socket.on('sendToAll',msg =>{// nghe du lieu tu server
    display(msg,'orther-message')
})
const display =(msg,type) =>{
    const msgDiv = document.createElement('div')
    let className = type
    msgDiv.classList.add(className,'message-row')
    let times = new Date().toLocaleDateString()
    let innerText = `
    <div class="message-title">
    <span>${msg.user}</span>
</div>
<div class="message-text">
    ${msg.message}
</div>
<div class="message-time">
    ${times}
</div>
</div>
    `;
    msgDiv.innerHTML = innerText;
    displayMsg.appendChild(msgDiv)
}
}());
var seconds
     ,countDiv = document.getElementById('countdown')
     ,secondPass
     ,countdown;

seconds = 300;
countdown = setInterval(function(){
    "use strict";

    secondPass();
}, 1000);

function secondPass(){
    "use strict";
    var minute = Math.floor(seconds / 60),
        remSeconds = seconds % 60;


    if(seconds < 10){
        remSeconds = "0" + remSeconds;
    }


    if(remSeconds < 10){
        remSeconds = "0" + remSeconds;
    }

    if(minute < 10){
        minute = "0" + minute;
    }
    countDiv.innerHTML = minute + " : " + remSeconds;

    if(seconds > 0){
        seconds--;
    }
    else{
        clearInterval(countdown)
        countDiv.innerHTML = "hết giờ";
    }
}

