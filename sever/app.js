const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const http = require('http');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
const mongoose = require('mongoose');
const io = require('socket.io')(8080,{
    cors: {
        origin: 'http://localhost:3001',//Cors để cho phép kết nối từ http://localhost:3001
    }
});

require('./db/connection'); 
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');
const Product = require('./models/Product');
const Order = require('./models/Order')
const Admin = require('./models/Admin');
const PublicKey = require('./models/PublicKey');

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Lấy token từ header
    if (!token) return res.sendStatus(401); // Không có token

    jwt.verify(token, process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY', (err, user) => {
        if (err) return res.sendStatus(403); // Token không hợp lệ
        req.userId = user.userId; // Gán userId từ token vào req
        next(); // Tiếp tục với middleware tiếp theo
    });
};
const authenticateAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized access. Please log in.' });

    jwt.verify(token, process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY', (err, admin) => {
        if (err) return res.status(403).json({ message: 'Forbidden. Invalid token.' });
        req.adminId = admin.adminId; // Token chứa adminId
        next();
    });
};
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail email
        pass: process.env.EMAIL_PASSWORD // Your Gmail password
    }
});

const port = process.env.PORT || 3000;

//Socket.io
let users=[];
io.on('connection',socket =>{
    console.log('connection',socket.id);// In ra bảng thông báo ở teminal khi có kết nối socket.io
    socket.on('addUser',userId =>{
        const isUserExist = users.find(user => user.userId === userId); //find: hàm kiểm tra người dùng đã có trong mảng ch
        if(!isUserExist){  // Nếu chưa có 
            const user ={userId, socketId: socket.id};// Tạo đối tượng với 2 thuộc tính userId và socketId
            users.push(user); // push : hàm thêm đối tượng vào user
            io.emit('getUsers',users); // io.emit cập nhật danh sách users
        }
    });

     //Gửi tới sendMessage với thông tin tin nhắn(Id gửi tin,Id người nhận,tin nhắn, id cuộc trò chuyện)
    socket.on('sendMessage', async ({senderId,receiverId,message,conversationId}) => { 
        // TÌm đối tượng dựa vào Id của họ và sử dụng hàm findById để truy xuất các dữ liệu thông tin người gửi từ CSDL
        const receiver = users.find(user => user.userId === receiverId);               
        const sender = users.find(user => user.userId === senderId);
        const user = await Users.findById(senderId);
        if(receiver){// Nếu có người nhận
            // Chọn socket của cả 2 người gửi và nhận sau đó  emit getMessage đến cả 2 để gửi tin nhắn cùng 1 lúc
            // emit dùng để phát sự kiện từ server đến các client đã kết nối
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage',{
                senderId,// Id người gửi
                message,// Rin nhắn
                conversationId,//Id cuộc trò chuyện
                receiverId,// Id người nhận 
                user:{ id: user._id , fullName: user.fullName, name: user.name }//User đối tượng từ DataBase gồm Id fullName và name 
            });
            }else{      
                //Nuế không có người nhận
                //Chọn người gửi dùng emit để kết nối getMessage đén socket bằng emit
                io.to(sender.socketId).emit('getMessage',{
                    senderId,
                    message,
                    conversationId,
                    receiverId,
                    user:{ id: user._id , fullName: user.fullName, name: user.name }
                });
        }
    });

    socket.on('disconnect', () => {
        // Xóa người dùng khỏi danh sách người dùng trực tuyến bằng hàm filter đối với user ngắt kết nối
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('usersUpdated', users); // Phát sự kiện để cập nhật danh sách người dùng
    });
    // io.emit('getUsers',socket.userId);
});


//Routes
app.get('/', (req, res) => {
    res.send('Welcome');
});

//Admin 
app.post('/api/registerAdmin', async (req, res) => {
    try {
        console.log('Received data:', req.body); // Kiểm tra dữ liệu
        const { fullName, email, password, phone, address } = req.body;

        // Kiểm tra các trường bắt buộc
        if (!fullName || !email || !password || !phone || !address) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc' });
        }

        // Kiểm tra nếu email đã tồn tại
        const isAlreadyExist = await Admin.findOne({ email });
        if (isAlreadyExist) {
            return res.status(400).json({ message: 'Email đã tồn tại' });
        }

        // Tạo đối tượng Admin mới
        const hashedPassword = await bcryptjs.hash(password, 10);
        const newAdmin = new Admin({
            fullName,
            email,
            phone,
            address,
            password: hashedPassword,
        });

        await newAdmin.save();  // Dùng await để đảm bảo dữ liệu được lưu
        return res.status(200).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản.' });
    } catch (error) {
        console.error('Error in registration:', error);
        return res.status(500).json({ message: 'Có lỗi xảy ra' });
    }
});

// Route đăng nhập
app.post('/api/loginAdmin', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send('Vui lòng điền đầy đủ các trường bắt buộc');
        }
        
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).send('Tài khoản hoặc mật khẩu không chính xác');
        }
        
        const validateAdmin = await bcryptjs.compare(password, admin.password);
        if (!validateAdmin) {
            return res.status(400).send('Tài khoản hoặc mật khẩu không chính xác');
        } else {
            const payload = {
                adminId: admin._id,
                email: admin.email,
            };
            const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

            jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                if (err) {
                    return res.status(500).send('Lỗi khi tạo token');
                }

                // Cập nhật token vào cơ sở dữ liệu (nếu cần)
                await Admin.updateOne({ _id: admin._id }, { $set: { token } });

                // Gửi lại thông tin admin và token
                return res.status(200).json({
                    admin: {
                        id: admin._id,
                        email: admin.email,
                        fullName: admin.fullName,
                        phone: admin.phone,
                        address: admin.address,
                    },
                    token,
                });
            });
        }
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});
// Đổi mật khẩu
app.post('/api/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1]; // Lấy token từ header

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Giải mã token
        const user = await Users.findById(decoded.userId); // Lấy user từ ID trong token

        // Kiểm tra mật khẩu hiện tại
        const isPasswordMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
        }

        // Mã hóa mật khẩu mới và cập nhật
        const hashedPassword = await bcryptjs.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ success: false, message: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }
});


app.put('/api/user/update/:id', authenticateToken, async (req, res) => { 
    const { id } = req.params;
    const { name, address, email, phone } = req.body;

    try {
        // Tìm và cập nhật thông tin người dùng theo ID
        const updatedUser = await Users.findByIdAndUpdate(
            id,
            { fullName: name, address, email, phone },
            { new: true } // Trả về tài liệu đã được cập nhật
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy' });
        }

        // Trả về thông báo thành công
        return res.status(200).json({ message: 'Cập nhật thành công', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
});

const sendVerificationEmail = async (email, verificationCode) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify your email address',
        text: `Your verification code is ${verificationCode}`
    };
    await transporter.sendMail(mailOptions);
};

// User registration with email verification
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password, phone, address } = req.body;

        if (!fullName || !email || !password || !phone || !address) {
            return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc' });
        }

        const isAlreadyExist = await Users.findOne({ email });
        if (isAlreadyExist) {
            return res.status(400).json({ message: 'Email đã tồn tại' });
        }

        const newUser = new Users({
            fullName,
            email,
            phone,
            address,
            verificationCode: Math.floor(100000 + Math.random() * 900000).toString(), // Random 6-digit code
            isVerified: false,
        });

        bcryptjs.hash(password, 10, async (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ message: 'Lỗi mã hóa mật khẩu' });
            }
            newUser.password = hashedPassword;

            await newUser.save();

            // TODO: Send verification email here using a function

            return res.status(200).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản.' });
        });
    } catch (error) {
        console.error('Error in registration:', error);
        res.status(500).json({ message: 'Có lỗi xảy ra' });
    }
});

// Verify email with verification code
app.post('/api/verify-email', async (req, res) => {
    const { email, verificationCode } = req.body;

    try {
        const user = await Users.findOne({ email });
        if (!user) {
            return res.status(404).send('Không tìm thấy người dùng');
        }

        if (user.verificationCode === verificationCode) {
            user.isVerified = true;
            user.verificationCode = null;
            await user.save();
            res.status(200).send('Xác thực thành công');
        } else {
            res.status(400).send('Mã xác nhận không đúng');
        }
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).send('Có lỗi xảy ra');
    }
});


// Đăng nhập
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body; // Lấy email và password từ body
        if (!email || !password) { // Kiểm tra xem cả email và password có điền đầy đủ không
            return res.status(400).send('Vui lòng điền đầy đủ các trường bắt buộc');
        }
        const user = await Users.findOne({ email }); // Tìm một Users có chứa email
        if (!user) { // Kiểm tra user có tồn tại
            return res.status(400).send('Tài khoản hoặc mật khẩu không chính xác');
        }
        // validateUser là kết quả của so sánh đúng hay sai của hàm compare
        const validateUser = await bcryptjs.compare(password, user.password);
        if (!validateUser) { // Nếu sai
            return res.status(400).send('Tài khoản hoặc mật khẩu không chính xác');
        } else { // Nếu đúng
            const payload = {
                userId: user._id,
                email: user.email
            };
            const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

            jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                await Users.updateOne({ _id: user._id }, {
                    $set: { token }
                });
                return res.status(200).json({
                    user: {  id: user._id, 
                        email: user.email, 
                        fullName: user.fullName,
                        phone: user.phone, 
                        address: user.address },
                    token: token
                });
            });
        }
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});

app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body; // Lấy ID người gửi và người nhận từ body 
        const newCoversation = new Conversations({ members: [senderId, receiverId] }); // Tạo cuộc trò chuyện mới 
        await newCoversation.save(); // Lưu vào database
        res.status(200).send('Tạo hội thoại thành công');
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});

// Lấy danh sách cuộc trò chuyện
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId; // Lấy ID người dùng 
        const conversations = await Conversations.find({ members: { $in: [userId] } }); // Tìm kiếm các trò chuyện có chứa ID người dùng
        const conversationUserData = await Promise.all(conversations.map(async (conversation) => { // Lấy thông tin chi tiết người nhận
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId); // Lấy thông tin chi tiết của người nhận
            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id };
        }));
        res.status(200).json(conversationUserData);
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});

// Gửi tin nhắn
app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body; // Lấy thông tin tin nhắn từ body
        if (!senderId || !message) return res.status(400).send('Vui lòng điền đầy đủ các trường bắt buộc');
        if (conversationId === 'new' && receiverId) { // Gửi tin nhắn trong trò chuyện mới
            const newCoversation = new Conversations({ members: [senderId, receiverId] }); // Tạo cuộc trò chuyện mới
            await newCoversation.save(); // Lưu
            const newMessage = new Messages({ conversationId: newCoversation._id, senderId, message }); // Tạo tin nhắn mới
            await newMessage.save(); // Lưu
            return res.status(200).send('Tin nhắn đã được gửi');
        } else if (!conversationId && !receiverId) {
            return res.status(400).send('Vui lòng điền đầy đủ các trường bắt buộc');
        }
        const newMessage = new Messages({ conversationId, senderId, message }); // Gửi tin nhắn trong cuộc trò chuyện đã có
        await newMessage.save();
        res.status(200).send('Tin nhắn đã được gửi');
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});

// Lấy tin nhắn
app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const checkMessages = async (conversationId) => { // Hàm lấy danh sách tin nhắn theo ID 
            const messages = await Messages.find({ conversationId }); // Tìm kiếm các tin nhắn trong cuộc trò chuyện
            const messageUserData = await Promise.all(messages.map(async (message) => { // Lấy thông tin chi tiết người gửi cho từng tin nhắn
                const user = await Users.findById(message.senderId);
                return { user: { id: user._id, email: user.email, fullName: user.fullName }, message: message.message };
            }));
            res.status(200).json(messageUserData);
        };
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') { // Kiểm tra cuộc trò chuyện mới
            const checkConversation = await Conversations.find({ members: { $all: [req.query.senderId, req.query.receiverId] } });
            if (checkConversation.length > 0) { // Nếu tìm thấy hội thoại khớp
                checkMessages(checkConversation[0]._id); // checkConversation[0]._id để lấy danh sách tin nhắn của cuộc trò chuyện đó.
            } else {
                return res.status(200).json([]);
            }
        } else {
            checkMessages(conversationId);
        }
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});

// Lấy danh sách người dùng
app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId; // Lấy ID người dùng
        const users = await Users.find({ _id: { $ne: userId } }); // Tìm kiếm tất cả người dùng $ne: không khớp
        const usersData = await Promise.all(users.map(async (user) => { // Lấy thông tin cần thiết của người dùng
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } };
        }));
        res.status(200).json(usersData);
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});
// API lấy danh sách người dùng
app.get('/api/users', authenticateAdmin, async (req, res) => {
    try {
      const users = await Users.find(); // Lấy tất cả người dùng từ database
      const usersData = users.map(user => ({
        id: user._id,   // Sử dụng _id làm ID cho người dùng
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address, // Đảm bảo rằng address cũng được trả về
      }));
      res.status(200).json(usersData); // Trả về dữ liệu người dùng
    } catch (error) {
      console.log(error, 'Error');
      res.status(500).send('Có lỗi xảy ra');
    }
  });
  
// Xóa người dùng 
app.delete('/api/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Tìm và xóa người dùng theo ID
        const user = await Users.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Có lỗi xảy ra');
    }
});

// 1. Lấy tất cả sản phẩm
app.get('/api/products', async (req, res) => {
    const { category } = req.query; // Lọc theo danh mục nếu có

    try {
        const filter = category ? { category } : {};
        const products = await Product.find(filter);
        
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách sản phẩm', error: error.message });
    }
});
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
      }
      res.status(200).json({
        ...product.toObject(),
        image: product.image || product.imageURL, // Ưu tiên sử dụng image
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  
  // 2. Thêm sản phẩm mới
  app.post('/api/products', authenticateAdmin, async (req, res) => {
    const { name, price, category, image, imageURL } = req.body;
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice)) {
      return res.status(400).json({ message: 'Giá không hợp lệ' });
    }
    const newProduct = new Product({
      name,
      price,
      category,
      image:image,
      imageURL:imageURL
    });
  
    try {
      const savedProduct = await newProduct.save();
     
      io.emit('productAdded', { product: savedProduct });
      
      res.status(201).json(savedProduct);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // 3. Sửa sản phẩm
  app.put('/api/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price, category, image , imageURL} = req.body;
  
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
          id,
          { name, price, category, image, imageURL },
          { new: true }
        );
    
        if (!updatedProduct) {
          return res.status(404).json({ message: 'Sản phẩm không tìm thấy' });
        }
      // Phát sự kiện sửa sản phẩm qua Socket.IO
        io.emit('productUpdated', { product: updatedProduct });
        res.status(200).json(updatedProduct);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
  
  // 4. Xóa sản phẩm
  app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
  
    try {
      const deletedProduct = await Product.findByIdAndDelete(id);
  
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Sản phẩm không tìm thấy' });
      }
      io.emit('productDeleted', { productId: id });
      res.status(200).json({ message: 'Sản phẩm đã bị xóa' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  // Tạo đơn hàng
  app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        const { items, totalPrice, address, customerName, customerPhone } = req.body; // Lấy dữ liệu từ frontend
        const userId = req.userId; // Lấy userId từ token

        if (!items || !totalPrice || !address || !customerName || !customerPhone) {
            return res.status(400).json({ message: 'Thiếu thông tin đơn hàng' });
        }

        // Tạo một đơn hàng mới
        const newOrder = new Order({
            userId, // Người dùng đặt hàng
            items, // Danh sách sản phẩm
            totalPrice, // Tổng số tiền
            address, // Địa chỉ giao hàng
            customerName, // Lưu tên khách hàng
            customerPhone, // Lưu số điện thoại khách hàng
            status: 'Pending', // Trạng thái đơn hàng ban đầu
            createdAt: new Date(), // Ngày tạo đơn hàng
        });

        // Lưu đơn hàng vào MongoDB
        const savedOrder = await newOrder.save();

        // Phát sự kiện để thông báo có đơn hàng mới
        io.emit('orderCreated', { order: savedOrder });

        res.status(201).json({ message: 'Đơn hàng đã được tạo', order: savedOrder });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Có lỗi xảy ra khi tạo đơn hàng' });
    }
});
app.put('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        const updatedOrder = await Order.findByIdAndUpdate(id, { status }, { new: true });

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Đơn hàng không tìm thấy' });
        }

        io.emit('orderUpdated', { order: updatedOrder });

        res.status(200).json({ message: 'Cập nhật trạng thái thành công', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Có lỗi xảy ra' });
    }
});
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({}); // Lấy tất cả đơn hàng
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng' });
    }
});
// app.patch('/api/orders/:id/status', ...)
const statusDescriptions = {
    'Pending': 'Đang xử lý',
    'Delivery': 'Đang vận chuyển',
    'Completed': 'Đã giao thành công',
    'Cancelled': 'Đã hủy đơn hàng'
};

app.patch('/api/orders/:id/status', authenticateAdmin, authenticateToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        // Kiểm tra trạng thái hợp lệ
        if (!['Pending', 'Delivery', 'Completed', 'Cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
        }

        // Cập nhật trạng thái cho đơn hàng
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId, 
            { status },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Đơn hàng không tìm thấy' });
        }

        // Tạo thông báo với mô tả trạng thái thay vì chỉ giá trị của trạng thái
        const notificationMessage = `-Trạng thái đơn hàng ${updatedOrder._id} : ${statusDescriptions[updatedOrder.status]}`;

        // Phát sự kiện thông báo tới các client qua Socket.IO
        io.emit('newNotification', { notification: notificationMessage });

        res.status(200).json({ message: 'Cập nhật trạng thái thành công', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Có lỗi xảy ra khi cập nhật trạng thái' });
    }
});


  
app.listen(port, () => {
    console.log('Listening on port ' + port);
});
