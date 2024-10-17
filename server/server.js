// server/server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// 路径设置
const PDF_DIR = path.join(__dirname, 'pdfs');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// 确保目录存在
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// 1. 处理 PDF 上传
app.post('/api/upload', upload.single('pdf'), (req, res) => {
  const tempPath = req.file.path;
  const targetPath = path.join(PDF_DIR, req.file.originalname);

  fs.rename(tempPath, targetPath, (err) => {
    if (err) return res.status(500).json({ message: '上传失败', error: err });
    res.status(200).json({ message: '上传成功', filename: req.file.originalname });
  });
});

// 2. 获取 PDF 列表
app.get('/api/pdfs', (req, res) => {
  fs.readdir(PDF_DIR, (err, files) => {
    if (err) return res.status(500).json({ message: '无法读取 PDF 目录', error: err });
    const pdfs = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
    res.status(200).json(pdfs);
  });
});

// 3. 下载 PDF
app.get('/api/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(PDF_DIR, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ message: '文件未找到' });
  }
});

// 4. 编辑 PDF（添加文本）
app.post('/api/edit', async (req, res) => {
  try {
    const { filename, edits } = req.body;
    const filePath = path.join(PDF_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF 文件未找到' });
    }

    const existingPdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    firstPage.drawText(edits.text, {
      x: edits.x,
      y: edits.y,
      size: edits.size || 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, modifiedPdfBytes);

    res.status(200).json({ message: 'PDF 编辑成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '编辑 PDF 时出错', error });
  }
});

// 启动服务器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
