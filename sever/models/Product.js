const mongoose = require('mongoose');

// Định nghĩa schema cho sản phẩm
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // Tên sản phẩm là bắt buộc
  },
  price: {
    type:Number,
    required: true, // Giá sản phẩm là bắt buộc
  },
  category: {
    type: String,
    
    required: true, // Danh mục sản phẩm là bắt buộc
  },
  image: {
    type: String, // Chứa đường dẫn tới hình ảnh sản phẩm
    required: false,
  },
  imageURL: {
    type: String, // Chứa URL của hình ảnh sản phẩm
    required: false,
  },
});

// Tạo model cho sản phẩm từ schema
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
