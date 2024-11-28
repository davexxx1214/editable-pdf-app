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
  
  const [searchText, setSearchText] = useState(''); // 新增状态用于存储搜索文本
  const [searchHighlights, setSearchHighlights] = useState([]); // 新增状态用于存储搜索高亮
  const [searchResults, setSearchResults] = useState([]); // 存储搜索结果
  const [selectedResult, setSelectedResult] = useState(null); // 存储选中的搜索结果

  const pdfWrapperRef = useRef(null);
  const pageRefs = useRef({});

  useEffect(() => {
    if (searchText) {
      const newSearchResults = [];
      for (let i = 1; i <= numPages; i++) {
        const pageRef = pageRefs.current[i];
        if (pageRef) {
          const textLayer = pageRef.querySelector('.textLayer');
          if (textLayer) {
            const textNodes = textLayer.querySelectorAll('span');
            textNodes.forEach((node) => {
              if (!node.firstChild || node.firstChild.nodeType !== Node.TEXT_NODE) return;
              
              // 检查节点是否可见
              const style = window.getComputedStyle(node);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return;
              }

              // 检查是否有重叠
            const nodeRect = node.getBoundingClientRect();
            const overlapping = Array.from(textNodes).some(otherNode => {
              if (otherNode === node) return false;
              const otherRect = otherNode.getBoundingClientRect();
              return !(nodeRect.right < otherRect.left || 
                      nodeRect.left > otherRect.right || 
                      nodeRect.bottom < otherRect.top || 
                      nodeRect.top > otherRect.bottom);
            });

            if (overlapping) return;

              const nodeText = node.textContent;
              if (!nodeText || !searchText) return;
              
              const searchRegex = new RegExp(searchText, 'gi');
              let match;
              
              try {
                while ((match = searchRegex.exec(nodeText)) !== null) {
                  if (match.index >= nodeText.length) continue;
                  
                  const range = document.createRange();
                  try {
                    range.setStart(node.firstChild, match.index);
                    range.setEnd(node.firstChild, Math.min(match.index + searchText.length, nodeText.length));
                    
                    const rect = range.getBoundingClientRect();
                    const pageRect = pageRef.getBoundingClientRect();
                    
                    // 获取所在行的完整文本内容
                    const lineText = node.parentElement.textContent;
                    
                    newSearchResults.push({
                      page: i,
                      x: rect.left - pageRect.left,
                      y: rect.top - pageRect.top,
                      width: rect.width,
                      height: rect.height,
                      text: searchText,
                      lineText: lineText, // 添加行文本
                      fullMatch: `...${lineText.substring(Math.max(0, match.index - 20), match.index)}${searchText}${lineText.substring(match.index + searchText.length, match.index + searchText.length + 20)}...`
                    });
                  } catch (e) {
                    console.warn('无法为此匹配创建范围:', e);
                    continue;
                  }
                }
              } catch (e) {
                console.warn('搜索文本时出错:', e);
              }
            });
          }
        }
      }
      setSearchResults(newSearchResults);
      setSelectedResult(null); // 重置选中结果
    } else {
      setSearchResults([]);
      setSelectedResult(null);
    }
  }, [searchText, numPages]);

  const renderSearchHighlights = (currentPage) => {
    if (!selectedResult) return null;
    
    // 只渲染选中的结果
    if (selectedResult.page !== currentPage) return null;
    
    return (
      <div
        className="highlight"
        style={{
          position: 'absolute',
          left: selectedResult.x,
          top: selectedResult.y,
          width: selectedResult.width,
          height: selectedResult.height,
          backgroundColor: 'blue',
          opacity: 0.4,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    );
  };

  const searchResultsDropdown = (
    <div className="search-section">
    <div className="search-input-wrapper">
      <label>搜索 PDF 文本：</label>
      <div className="search-input-container">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="输入要搜索的文本"
        />
        {searchText && (
          <button 
            className="clear-search-btn"
            onClick={() => setSearchText('')}
            title="清除搜索"
            aria-label="清除搜索"
          />
        )}
      </div>
    </div>
      {searchResults.length > 0 && (
        <div className="search-results-dropdown">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className={`search-result-item ${selectedResult === result ? 'selected' : ''}`}
              onClick={() => setSelectedResult(result)}
            >
              <span>第 {result.page} 页: </span>
              <span dangerouslySetInnerHTML={{ __html: result.fullMatch.replace(searchText, `<mark>${searchText}</mark>`) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

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

  // 处理鼠标抬起事件以捕捉文本选择
useEffect(() => {
  const handleMouseUp = () => {
    if (selectedBox === null) return;
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText && file) {
      const range = selection.getRangeAt(0);

      // 检查选择是否跨越多个行
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;

      // 获取选择的起始和结束行
      const startLine = startContainer.parentElement.closest('.textLayer')?.getBoundingClientRect().top;
      const endLine = endContainer.parentElement.closest('.textLayer')?.getBoundingClientRect().top;

      if (startLine !== endLine) {
        console.log('检测到跨行选择，将清除所选文本');
        selection.removeAllRanges();
        return;
      }

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
                  {renderSearchHighlights(index + 1)} {/* 新增渲染搜索高亮 */}
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
          {searchResultsDropdown}
        </div>
      </div>
    </div>
  );
}

export default App;