const mongoose = require('mongoose');
const url =`mongodb+srv://DawgCheeseShop:khoa123456@dawgcheeseshop.ciepk.mongodb.net/`;

mongoose.connect(url).then(() => console.log('Kết nối thành công'))
.catch(err => console.error('Lỗi kết nối:', err));