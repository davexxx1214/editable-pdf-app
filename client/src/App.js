import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';

// 设置 pdfjs Worker 来自 public 文件夹
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

function App() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);
  const [textBoxes, setTextBoxes] = useState(['', '', '', '']);
  // 每个文本框对应一个高亮，存储 { page, x, y, width, height, text }
  const [highlights, setHighlights] = useState([null, null, null, null]);
  const pdfWrapperRef = useRef(null);

  // 处理文件上传
  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setHighlights([null, null, null, null]);
    setTextBoxes(['', '', '', '']);
    setSelectedBox(null);
  };

  // 处理文本框点击
  const handleBoxClick = (index) => {
    setSelectedBox(index);
    // 清除当前的文本选择
    window.getSelection().removeAllRanges();
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