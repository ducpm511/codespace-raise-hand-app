const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname + "/public"));

// Trang chủ
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/host.html");
});

// Trang người dùng
app.get("/user", (req, res) => {
  res.sendFile(__dirname + "/public/user.html");
});

const players = [];

let sessionPIN = null;

// Hàm sắp xếp danh sách người chơi theo thứ tự thời gian dơ tay
function sortPlayersByRaisedHandTime(players) {
  return players.sort((a, b) => {
    if (a.raisedHandTime === null) return 1; // Đưa những người chưa dơ tay lên đầu danh sách
    if (b.raisedHandTime === null) return -1;
    return a.raisedHandTime - b.raisedHandTime;
  });
}

// Socket.IO: Xử lý sự kiện khi kết nối mới
io.on("connection", (socket) => {
  console.log("New user connected");

  // Socket.IO: Xử lý sự kiện khi host bắt đầu phiên chơi
  socket.on("startSession", () => {
    // Tạo mã PIN ngẫu nhiên (4 chữ số)
    sessionPIN = Math.floor(1000 + Math.random() * 9000).toString();

    // Lưu mã PIN và gửi cho host
    socket.emit("sessionPIN", sessionPIN);
  });

  // Socket.IO: Xử lý sự kiện khi người dùng gửi yêu cầu tham gia phiên chơi
  socket.on("join", (data) => {
    const { pin, nickname } = data;

    // Kiểm tra mã PIN
    if (pin !== sessionPIN) {
      socket.emit("joinFailure");
      return;
    }

    // Mã PIN đúng
    // Lưu thông tin người chơi và thông báo thành công
    const player = {
      id: socket.id,
      nickname: nickname,
      raisedHand: false,
      raisedHandTime: null,
    };
    players.push(player);

    socket.emit("joinSuccess");
    io.emit("updatePlayerList", sortPlayersByRaisedHandTime(players));
  });

  // Socket.IO: Xử lý sự kiện khi có yêu cầu dơ tay
  socket.on("raiseHand", () => {
    const player = players.find((p) => p.id === socket.id);
    if (player) {
      player.raisedHand = true;
      player.raisedHandTime = Date.now(); // Lưu thời gian dơ tay
      io.emit("updatePlayerList", sortPlayersByRaisedHandTime(players));
    }
  });

  // Socket.IO: Xử lý sự kiện khi có yêu cầu huỷ bỏ dơ tay
  socket.on("cancelRaiseHand", () => {
    const player = players.find((p) => p.id === socket.id);
    if (player) {
      player.raisedHand = false;
      player.raisedHandTime = null; // Xóa thời gian dơ tay
      io.emit("updatePlayerList", sortPlayersByRaisedHandTime(players));
    }
  });

  // Socket.IO: Xử lý sự kiện khi người dùng ngắt kết nối
  socket.on("disconnect", () => {
    console.log("User disconnected");

    const index = players.findIndex((p) => p.id === socket.id);
    if (index !== -1) {
      players.splice(index, 1);
      io.emit("updatePlayerList", sortPlayersByRaisedHandTime(players));
    }
  });

  // Socket.IO: Xử lý sự kiện khi có yêu cầu reset danh sách người chơi
  socket.on("resetPlayerList", () => {
    players.length = 0; // Xóa tất cả người chơi trong danh sách
    io.emit("resetPlayerListSuccess");
    io.emit("updatePlayerList", players);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
