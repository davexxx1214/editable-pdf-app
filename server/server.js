const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { savePDFFile, listSavedPDFs } = require('./fileController');
const zlib = require('zlib'); // 用于处理压缩文件

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// 保存 PDF 接口
app.post('/api/save-pdf', upload.single('pdf'), (req, res) => {
  try {
    const savedFile = savePDFFile(req.file.buffer);
    res.json(savedFile);
  } catch (error) {
    res.status(500).json({ error: '保存失败' });
  }
});

// 获取已保存 PDF 列表
app.get('/api/saved-pdfs', (req, res) => {
  try {
    const savedFiles = listSavedPDFs();
    res.json(savedFiles);
  } catch (error) {
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

// 获取特定已保存的 PDF
app.get('/api/get-pdf/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  
  try {
    // 读取压缩文件
    const compressedBuffer = fs.readFileSync(filePath);
    
    // 解压缩
    const pdfBuffer = zlib.gunzipSync(compressedBuffer);
    
    // 设置正确的 Content-Type
    res.setHeader('Content-Type', 'application/pdf');
    
    // 发送解压缩后的 PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('读取 PDF 失败', error);
    res.status(500).send('无法读取文件');
  }
});

app.listen(3001, () => {
  console.log('服务器运行在 3001 端口');
});