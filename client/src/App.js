// client/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

// 设置 PDF.js Worker
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [currentPdf, setCurrentPdf] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [textEdit, setTextEdit] = useState({ text: '', x: 50, y: 750, size: 12 });
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    fetchPdfs();
  }, []);

  const fetchPdfs = async () => {
    try {
      const res = await axios.get('/api/pdfs');
      setPdfs(res.data);
    } catch (error) {
      console.error('获取 PDF 列表失败:', error);
    }
  };

  const onFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const onFileUpload = async () => {
    if (!selectedFile) {
      alert('请选择一个 PDF 文件上传');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('上传成功');
      setSelectedFile(null);
      fetchPdfs();
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleEdit = async () => {
    if (!currentPdf) {
      alert('请选择一个 PDF 进行编辑');
      return;
    }

    if (!textEdit.text) {
      alert('请输入要添加的文本');
      return;
    }

    try {
      const res = await axios.post('/api/edit', {
        filename: currentPdf,
        edits: textEdit,
      });
      alert('编辑成功');
      setRefresh(!refresh); // 用于刷新 PDF 显示
    } catch (error) {
      console.error('编辑失败:', error);
      alert('编辑失败');
    }
  };

  const downloadPdf = () => {
    if (!currentPdf) {
      alert('请选择一个 PDF 下载');
      return;
    }
    window.location.href = `/api/pdf/${currentPdf}`;
  };

  return (
    <div className="App">
      <h1>可编辑的 PDF 显示页面</h1>

      {/* 上传 PDF */}
      <div className="upload-section">
        <h2>上传 PDF 文件</h2>
        <input type="file" accept="application/pdf" onChange={onFileChange} />
        <button onClick={onFileUpload}>上传</button>
      </div>

      {/* PDF 列表 */}
      <div className="pdf-list-section">
        <h2>已上传的 PDF 文件</h2>
        <ul>
          {pdfs.map((pdf, index) => (
            <li key={index}>
              <button onClick={() => setCurrentPdf(pdf)}>{pdf}</button>
            </li>
          ))}
        </ul>
      </div>

      {/* PDF 预览 */}
      {currentPdf && (
        <div className="pdf-viewer-section">
          <h2>PDF 预览: {currentPdf}</h2>
          <Document
            file={`/api/pdf/${currentPdf}?t=${refresh ? Date.now() : ''}`} // 防止缓存
            onLoadSuccess={onDocumentLoadSuccess}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <Page key={`page_${index + 1}`} pageNumber={index + 1} />
            ))}
          </Document>
        </div>
      )}

      {/* 编辑 PDF */}
      {currentPdf && (
        <div className="edit-section">
          <h2>编辑 PDF: {currentPdf}</h2>
          <div className="edit-form">
            <label>
              添加文本:
              <input
                type="text"
                value={textEdit.text}
                onChange={(e) => setTextEdit({ ...textEdit, text: e.target.value })}
              />
            </label>
            <label>
              X 坐标:
              <input
                type="number"
                value={textEdit.x}
                onChange={(e) => setTextEdit({ ...textEdit, x: parseInt(e.target.value) })}
              />
            </label>
            <label>
              Y 坐标:
              <input
                type="number"
                value={textEdit.y}
                onChange={(e) => setTextEdit({ ...textEdit, y: parseInt(e.target.value) })}
              />
            </label>
            <label>
              字体大小:
              <input
                type="number"
                value={textEdit.size}
                onChange={(e) => setTextEdit({ ...textEdit, size: parseInt(e.target.value) })}
              />
            </label>
            <button onClick={handleEdit}>添加文本</button>
          </div>
          <button onClick={downloadPdf}>下载 PDF</button>
        </div>
      )}
    </div>
  );
}

export default App;
