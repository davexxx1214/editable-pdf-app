import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import './App.css';

// 设置 pdfjs Worker 来自 public 文件夹
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

function App() {
  const [file, setFile] = useState(null);
  const [savedPDFs, setSavedPDFs] = useState([]); // 保存的 PDF 列表
  const [numPages, setNumPages] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);
  const [textBoxes, setTextBoxes] = useState(['', '', '', '']);
  const [highlights, setHighlights] = useState([null, null, null, null]);
  const pdfWrapperRef = useRef(null);
  const pageRefs = useRef({});

  // 获取已保存的 PDF 列表
  useEffect(() => {
    const fetchSavedPDFs = async () => {
      try {
        const response = await axios.get('/api/saved-pdfs');
        // 确保使用 name 属性或原始值
        setSavedPDFs(response.data.map(pdf => pdf.name || pdf));
      } catch (error) {
        console.error('获取 PDF 列表失败', error);
      }
    };
    fetchSavedPDFs();
  }, []);

  // 从已保存的 PDF 中选择文件
  const handleSelectSavedPDF = async (filename) => {
    try {
      const response = await axios.get(`/api/get-pdf/${filename}`, {
        // 改为 base64 编码
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/pdf'
        }
      });
  
      // 将 ArrayBuffer 转换为 Base64
      const base64Pdf = btoa(
        new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
  
      // 使用 data URI 格式
      const pdfDataUri = `data:application/pdf;base64,${base64Pdf}`;
  
      setFile(pdfDataUri);  // 使用 data URI
      setHighlights([null, null, null, null]);
      setTextBoxes(['', '', '', '']);
      setSelectedBox(null);
    } catch (error) {
      console.error('加载 PDF 失败', error);
      alert('无法加载 PDF 文件，请检查文件是否损坏');
    }
  };

// 处理文件上传
const onFileChange = async (e) => {
  const uploadedFile = e.target.files[0];
  // 确保只处理 PDF 文件
  if (uploadedFile && uploadedFile.type === 'application/pdf') {
    const formData = new FormData();
    formData.append('pdf', uploadedFile);

    try {
      // 上传 PDF 到服务器
      await axios.post('/api/save-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 重新获取已保存的 PDF 列表
      const response = await axios.get('/api/saved-pdfs');
      setSavedPDFs(response.data.map(pdf => pdf.name || pdf));

      // 创建 URL 对象
      const pdfUrl = URL.createObjectURL(uploadedFile);
      setFile(pdfUrl);
      setHighlights([null, null, null, null]);
      setTextBoxes(['', '', '', '']);
      setSelectedBox(null);
    } catch (error) {
      console.error('上传 PDF 失败', error);
    }
  }
};

// 注意：在组件卸载时清理 URL 对象
useEffect(() => {
  return () => {
    if (file) {
      URL.revokeObjectURL(file);
    }
  };
}, [file]);

  // 处理文本框点击
  const handleBoxClick = (index) => {
    setSelectedBox(index);
  };

  // 监听鼠标抬起事件以捕捉文本选择
  useEffect(() => {
    const handleMouseUp = () => {
      if (selectedBox === null) return;
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      if (selectedText && file) {
        const range = selection.getRangeAt(0);

        // 找到包含选择范围的 page-container
        let ancestor = range.commonAncestorContainer;
        while (ancestor && !ancestor.classList?.contains('page-container')) {
          ancestor = ancestor.parentNode;
        }
        if (!ancestor) return;

        const pageNumber = parseInt(ancestor.getAttribute('data-page-number'), 10);
        if (isNaN(pageNumber)) return;

        const rect = range.getBoundingClientRect();
        const pageRect = ancestor.getBoundingClientRect();

        // 计算相对于页面容器的坐标
        const x = rect.left - pageRect.left;
        const y = rect.top - pageRect.top;
        const width = rect.width;
        const height = rect.height;

        const newHighlights = [...highlights];
        newHighlights[selectedBox] = { page: pageNumber, x, y, width, height, text: selectedText };
        setHighlights(newHighlights);

        const newTextBoxes = [...textBoxes];
        newTextBoxes[selectedBox] = selectedText;
        setTextBoxes(newTextBoxes);

        // 清除选择
        window.getSelection().removeAllRanges();
        setSelectedBox(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedBox, highlights, textBoxes, file]);

  // 更新文本框内容
  const handleInputChange = (index, value) => {
    const newTextBoxes = [...textBoxes];
    newTextBoxes[index] = value;
    setTextBoxes(newTextBoxes);
  };

  // 渲染高亮层
  const renderHighlights = (currentPage) => {
    return highlights.map((hl, index) => {
      if (!hl || hl.page !== currentPage) return null;
      return (
        <div
          key={index}
          className="highlight"
          style={{
            position: 'absolute',
            left: hl.x,
            top: hl.y,
            width: hl.width,
            height: hl.height,
            backgroundColor: 'yellow',
            opacity: 0.4,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        ></div>
      );
    });
  };

  return (
    <div className="App">
      <h1>PDF 查看器</h1>
      <div className="container">
        {/* 左侧：PDF 预览 */}
        <div className="pdf-viewer" ref={pdfWrapperRef}>
          <input type="file" accept="application/pdf" onChange={onFileChange} />
          
          {/* 已保存的 PDF 列表 */}
          <div className="saved-pdfs">
            <h3>已保存的 PDF</h3>
              {savedPDFs.map((pdf) => (
                <button 
                  key={pdf.name || pdf} // 使用 name 或原始值作为 key
                  onClick={() => handleSelectSavedPDF(pdf.name || pdf)}
                >
                  {pdf.name || pdf} {/* 显示文件名 */}
                </button>
              ))}
          </div>
          
          {file && (
            <Document
              file={file}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              className="document"
            >
              {Array.from(new Array(numPages), (el, index) => (
                <div
                  key={`page_${index + 1}`}
                  className="page-container"
                  data-page-number={index + 1}
                  ref={(el) => (pageRefs.current[index + 1] = el)}
                >
                  <Page
                    pageNumber={index + 1}
                    width={600}
                    renderAnnotationLayer={false}
                    renderTextLayer={true}
                  />
                  {/* 渲染对应的高亮 */}
                  {renderHighlights(index + 1)}
                </div>
              ))}
            </Document>
          )}
        </div>

        {/* 右侧：控制面板 */}
        <div className="control-panel">
          <h2>文本框</h2>
          {textBoxes.map((text, index) => (
            <div key={index}>
              <label>文本框 {index + 1}：</label>
              <input
                type="text"
                value={text}
                onClick={() => handleBoxClick(index)}
                onChange={(e) => handleInputChange(index, e.target.value)}
                placeholder="点击选择 PDF 中的文本"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;