const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function compressPDF(fileBuffer) {
  // 使用 zlib 压缩文件
  const compressedBuffer = zlib.gzipSync(fileBuffer);
  return compressedBuffer;
}

function savePDFFile(fileBuffer) {
  // 压缩文件
  const compressedBuffer = compressPDF(fileBuffer);
  
  // 创建保存目录
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  // 生成唯一文件名
  const fileName = `pdf_${Date.now()}.pdf.gz`;
  const filePath = path.join(uploadDir, fileName);

  // 保存压缩文件
  fs.writeFileSync(filePath, compressedBuffer);

  return {
    originalName: fileName,
    path: filePath
  };
}

function listSavedPDFs() {
    try {
      const uploadsDir = path.join(__dirname, 'uploads');
      // 确保返回文件名数组
      return fs.readdirSync(uploadsDir).map(filename => ({
        name: filename,
        path: path.join(uploadsDir, filename)
      }));
    } catch (error) {
      console.error('获取文件列表失败', error);
      return []; // 返回空数组以防错误
    }
  }

module.exports = {
  savePDFFile,
  listSavedPDFs
};