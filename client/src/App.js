import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
  const [editText, setEditText] = useState('');

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
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const instances = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });

        const renderedWidth = 600; // 渲染时设置的宽度
        const scale = renderedWidth / viewport.width; // 计算缩放因子

        const textContent = await page.getTextContent();

        textContent.items.forEach((item) => {
          if (item.str.includes(searchTerm)) { // 使用 includes 以匹配部分文本
            const x = item.transform[4] / scale; // 转换 x 坐标
            const y = item.transform[5] / scale; // 转换 y 坐标
            const width = item.width / scale;
            const height = item.height / scale;

            instances.push({
              id: instances.length + 1,
              text: item.str,
              pageNumber: pageNum,
              x: x,
              y: y,
              width: width,
              height: height,
            });
          }
        });
      }

      console.log('提取的文本实例:', instances); // 调试输出
      setTextInstances(instances);
    } catch (error) {
      console.error('提取文本实例时发生错误:', error);
      alert('提取文本实例时发生错误，请检查控制台以获取详细信息。');
    }
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
  
      // 使用标准字体 Helvetica
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
      const pages = pdfDoc.getPages();
      const { pageNumber, x, y, width, height } = selectedInstance;
  
      const page = pages[pageNumber - 1];
      const { height: pageHeight } = page.getSize();
  
      // 动态调整偏移量和高度倍率
      const offsetY = -10; // 调整偏移量
      const heightMultiplier = 2.0; // 调整高度倍率
  
      const adjustedY = y - offsetY;
  
      // 计算覆盖矩形的位置和大小
      const rectX = x - 2; // 增加填充
      const rectY = adjustedY - height * 0.5; // 调整 y 坐标
      const rectWidth = width + 4; // 增加填充
      const rectHeight = height * heightMultiplier; // 增加高度倍率
  
      console.log(`Drawing rectangle at x:${rectX}, y:${rectY}, width:${rectWidth}, height:${rectHeight}`);
      console.log(`Original text: "${selectedInstance.text}", replacing with: "${editText}"`);
  
      // 绘制白色矩形覆盖原有文本
      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
        color: rgb(1, 1, 1),
      });
  
      // 绘制替换后的文本，确保垂直居中
      const newTextY = rectY + (rectHeight - height * 0.8) / 2;
  
      page.drawText(editText, {
        x: x,
        y: newTextY,
        size: height * 0.8, // 根据高度调整字体大小
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
  
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  
      const url = URL.createObjectURL(blob);
      setEditedPdf(url);
  
      console.log('替换成功，新的 PDF URL:', url);
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
          {editedPdf && (
            <div>
              <h2>修改后的 PDF 预览</h2>
              <Document file={editedPdf}>
                {Array.from(new Array(numPages), (el, index) => (
                  <Page key={`page_${index + 1}`} pageNumber={index + 1} width={600} />
                ))}
              </Document>
            </div>
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
                      {`第 ${instance.pageNumber} 页: "${instance.text}" at (${instance.x.toFixed(2)}, ${instance.y.toFixed(2)})`}
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
            <>
              <button onClick={downloadPdf}>
                下载编辑后的 PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
