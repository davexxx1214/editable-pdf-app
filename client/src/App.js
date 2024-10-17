import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import './App.css';

// 设置 pdfjs Worker 来自 public 文件夹
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

function App() {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [editedPdf, setEditedPdf] = useState(null);
  const [textInstances, setTextInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [editText, setEditText] = useState(''); // 新增状态用于编辑文本

  // 处理文件上传
  const onFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setEditedPdf(null);
    setTextInstances([]);
    setSelectedInstance(null);

    if (uploadedFile && searchText) {
      extractTextInstances(uploadedFile, searchText);
    }
  };

  // 提取文本实例
  const extractTextInstances = async (file, searchTerm) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const instances = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      textContent.items.forEach((item) => {
        if (item.str.includes(searchTerm)) { // 使用 includes 以匹配部分文本
          const transform = item.transform;
          const x = transform[4];
          const y = transform[5];
          instances.push({
            id: instances.length + 1,
            text: item.str,
            pageNumber: pageNum,
            x: x,
            y: y,
            width: item.width,
            height: item.height,
          });
        }
      });
    }

    console.log('提取的文本实例:', instances); // 调试输出
    setTextInstances(instances);
  };

  // 监听 searchText 变化，重新提取文本实例
  useEffect(() => {
    if (file && searchText) {
      extractTextInstances(file, searchText);
    } else {
      setTextInstances([]);
    }
  }, [file, searchText]);

  // 加载字体文件并返回 Uint8Array
  const loadFont = async () => {
    const response = await fetch('/fonts/Roboto-Regular.ttf'); // 确保字体文件放在 public/fonts 目录下
    if (!response.ok) {
      throw new Error('无法加载字体文件');
    }
    const fontArrayBuffer = await response.arrayBuffer();
    return new Uint8Array(fontArrayBuffer);
  };

  // 处理文本选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText) {
      setSearchText(selectedText);
      extractTextInstances(file, selectedText);
    }
  };

  // 处理编辑操作
  const handleEdit = async () => {
    if (!file) {
      alert('请上传一个 PDF 文件');
      return;
    }

    if (!selectedInstance) {
      alert('请先选择要替换的文本实例');
      return;
    }

    if (!editText) {
      alert('请填写替换后的文本');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      pdfDoc.registerFontkit(fontkit);

      const fontBytes = await loadFont();
      const customFont = await pdfDoc.embedFont(fontBytes);

      const pages = pdfDoc.getPages();

      const { pageNumber, x, y, width, height } = selectedInstance;

      const page = pages[pageNumber - 1];
      const { height: pageHeight } = page.getSize();

      // 覆盖原有文本的背景
      page.drawRectangle({
        x: x,
        y: pageHeight - y - height,
        width: width,
        height: height,
        color: rgb(1, 1, 1),
      });

      // 添加替换后的文本
      page.drawText(editText, {
        x: x,
        y: pageHeight - y - height,
        size: height - 4,
        font: customFont,
        color: rgb(0, 0, 0),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setEditedPdf(url);

      console.log('替换成功，新的 PDF URL:', url); // 调试输出
    } catch (error) {
      console.error('编辑 PDF 失败:', error);
      alert('编辑 PDF 时发生错误，请检查控制台以获取详细信息。');
    }
  };

  // 处理 PDF 下载
  const downloadPdf = () => {
    if (!editedPdf) {
      alert('请先编辑 PDF');
      return;
    }
    const link = document.createElement('a');
    link.href = editedPdf;
    link.download = 'edited.pdf';
    link.click();
  };

  return (
    <div className="App">
      <h1>PDF 编辑器</h1>
      <div className="container">
        {/* 左侧：PDF 预览 */}
        <div className="pdf-viewer" onMouseUp={handleTextSelection}>
          <input type="file" accept="application/pdf" onChange={onFileChange} />
          {file && (
            <Document file={file} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
              {Array.from(new Array(numPages), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  width={600}
                  renderAnnotationLayer={false}
                  renderTextLayer={true} // 启用文本层渲染
                />
              ))}
            </Document>
          )}
        </div>

        {/* 右侧：控制面板 */}
        <div className="control-panel">
          <h2>替换文本</h2>
          <label>
            搜索文本：
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="输入要搜索的文本"
            />
          </label>
          <br />
          <button onClick={() => extractTextInstances(file, searchText)} disabled={!searchText}>
            搜索文本
          </button>
          <br />
          {textInstances.length > 0 && (
            <>
              <label>
                选择要替换的实例：
                <select
                  value={selectedInstance ? selectedInstance.id : ''}
                  onChange={(e) => {
                    const selectedId = parseInt(e.target.value, 10);
                    const instance = textInstances.find((t) => t.id === selectedId);
                    setSelectedInstance(instance);
                    setEditText(instance ? instance.text : ''); // 设置编辑文本
                  }}
                >
                  <option value="">-- 选择实例 --</option>
                  {textInstances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {`第 ${instance.pageNumber} 页: "${instance.text}" at (${instance.x}, ${instance.y})`}
                    </option>
                  ))}
                </select>
              </label>
              <br />
              <label>
                编辑文本：
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="输入新的文本"
                />
              </label>
              <br />
              <button onClick={handleEdit} disabled={!selectedInstance || !editText}>
                替换选中的文本
              </button>
            </>
          )}
          <br />
          {editedPdf && (
            <button onClick={downloadPdf}>
              下载编辑后的 PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;