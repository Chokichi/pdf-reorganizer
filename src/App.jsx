// App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import { useMediaQuery, useTheme } from '@mui/material';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;



function PDFThumbnail({ page, scale }) {
  const containerRef = useRef();

  useEffect(() => {
    const renderThumbnail = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(page.preview);
        const pdf = await loadingTask.promise;
        const pdfPage = await pdf.getPage(page.pageIndex + 1);
        const pageRotation = page.rotation || pdfPage.rotate;
        const viewport = pdfPage.getViewport({ scale, rotation: page.rotation || pdfPage.rotate });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({ canvasContext: context, viewport }).promise;

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(canvas);
        }
      } catch (err) {
        console.error('Error rendering thumbnail:', err);
      }
    };
    renderThumbnail();
  }, [page.preview, page.pageIndex, page.rotation, scale]);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'inline-block',
        transition: 'transform 0.3s ease',
        overflow: 'hidden'
      }}
    />
  );
}


function DragPreviewGroup({ pages, scale }) {
  if (!pages || pages.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, p: 1, backgroundColor: 'background.paper', border: '1px solid #ccc', borderRadius: 1 }}>
      {pages.map((page) => (
        <Box key={page.id} sx={{ width: 50 }}>
          <PDFThumbnail page={page} scale={scale * 0.3} />
        </Box>
      ))}
    </Box>
  );
}

function SortableItem({ id, page, scale, containerWidth, selected, onSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id });

  const theme = useTheme();
  const thumbnailsPerRow = containerWidth < 600 ? 2 : 3;
  const availableWidth = containerWidth - ((thumbnailsPerRow - 1) * parseFloat(theme.spacing(2)) + 2);
  const targetWidth = availableWidth / thumbnailsPerRow;

  console.log(thumbnailsPerRow)
  console.log(containerWidth)
  console.log(availableWidth)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const standardWidth = 612;
  const baseScale = Math.min(1, targetWidth / standardWidth);
  const normalizedScale = standardWidth / page.width;
  const effectiveScale = baseScale * normalizedScale * scale;

  return (
    <Grid ref={setNodeRef} style={style} sx={{ gridColumn: 'span 2' }}>
      <Paper elevation={3} sx={{
         py: 0, 
         px: 0,
         flexDirection: 'column',
         display: 'flex', 
         alignItems: 'center'
         }}>
        <Box sx={{ 
          display: 'flex', 
          width: '100%',
          alignItems: 'center', 
          mb: 0,
          px: 2,
          py: 0,
          justifyContent: 'space-between'
          }}>
          <Checkbox checked={selected} onChange={() => onSelect(id)} size="small" />
          <IconButton {...attributes} {...listeners} size="small" sx={{ cursor: 'grab', touchAction: 'none' }}>
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Box>
        <PDFThumbnail page={page} scale={effectiveScale} />
        <Typography variant="caption" noWrap>
          {page.file.name} — Pg {page.pageIndex + 1}
        </Typography>
      </Paper>
    </Grid>
  );
}

export default function App() {
  const [pdfPages, setPdfPages] = useState([]);
  const [view, setView] = useState('upload');
  const [scale, setScale] = useState(1.0);
  const [darkMode, setDarkMode] = useState(true);
  const [optimizeCanvas, setOptimizeCanvas] = useState(true);
  const [flattenPages, setFlattenPages] = useState(false);
  const [selectedPages, setSelectedPages] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    };

    return () => observer.disconnect();
  }, []);

  const theme = createTheme({ palette: { mode: darkMode ? 'dark' : 'light' } });
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const toggleSelection = (id) => {
    setSelectedPages((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedPages([]);
  const deleteSelected = () => {
    setPdfPages((pages) => {
      const newPages = pages.filter((p) => !selectedPages.includes(p.id));
      const validIds = newPages.map((p) => p.id);
      setSelectedPages((prev) => prev.filter((id) => validIds.includes(id)));
      return newPages;
    });
  };
  const rotateSelected = () => {
    setPdfPages((pages) =>
      pages.map((p) =>
        selectedPages.includes(p.id)
          ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 }
          : p
      )
    );
  };

  const onDrop = async (acceptedFiles) => {
    const newPages = [];

    for (const file of acceptedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;
      const previewURL = URL.createObjectURL(file);

      for (let i = 0; i < pageCount; i++) {
        const pdfPage = await pdf.getPage(i + 1);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const width = viewport.width;
        const height = viewport.height;

        console.log(`Page ${i + 1} of ${file.name}: width = ${width}, height = ${height}`);


        newPages.push({
          id: `${file.name}-page-${i}-${Date.now()}`,
          file,
          fileName: file.name,
          pageIndex: i,
          preview: previewURL,
          rotation: 0,
          width,
          height
        });
      }
    }

    setPdfPages((prev) => [...prev, ...newPages]);
    setView('reorder');
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'application/pdf': [] } });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 0
      }
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (active.id !== over?.id) {
      const activeIds = selectedPages.includes(active.id) ? selectedPages : [active.id];

      const oldIndexes = activeIds.map(id => pdfPages.findIndex(p => p.id === id));
      const newIndex = pdfPages.findIndex(p => p.id === over.id);

      const movedPages = oldIndexes.map(i => pdfPages[i]);
      const remainingPages = pdfPages.filter(p => !activeIds.includes(p.id));
      const before = remainingPages.slice(0, newIndex);
      const after = remainingPages.slice(newIndex);

      setPdfPages([...before, ...movedPages, ...after]);
    }
  };

  const activeDraggedPages = pdfPages.filter((p) => selectedPages.includes(p.id));


  const mergeAndDownload = async () => {
    try {
      const mergedPdf = await PDFDocument.create();
      const loadedPdfs = new Map();

      const MAX_WIDTH = 612; // 8.5 in
      const MAX_HEIGHT = 792; // 11 in

      for (const page of pdfPages) {
        let srcPdf = loadedPdfs.get(page.file.name);
        if (!srcPdf) {
          const buffer = await page.file.arrayBuffer();
          srcPdf = await PDFDocument.load(buffer);
          loadedPdfs.set(page.file.name, srcPdf);

          // 🧪 Log annotations on load
          console.log(`📄 Inspecting PDF: ${page.file.name}`);
          const pageCount = srcPdf.getPageCount();
          for (let i = 0; i < pageCount; i++) {
            const inspectPage = srcPdf.getPage(i);
            const annots = inspectPage.node.lookupMaybe('Annots');
            if (annots?.array) {
              console.log(`🧪 Page ${i + 1} has ${annots.size()} annotation(s):`);
              annots.asArray().forEach((annotRef, idx) => {
                const annot = srcPdf.context.lookup(annotRef);
                const subtype = annot.lookupMaybe('Subtype');
                const action = annot.lookupMaybe('A');
                const actionType = action?.lookupMaybe('S');
                const uri = action?.lookupMaybe('URI');
                console.log(`  Annotation ${idx + 1}:`, {
                  subtype: subtype?.name,
                  actionType: actionType?.name,
                  uri: uri?.value,
                });
              });
            }
          }
        }

        const srcPage = srcPdf.getPage(page.pageIndex);
        const { width: w, height: h } = srcPage.getSize();

        if (flattenPages) {
          const canvas = document.createElement('canvas');
          const viewportScale = 2;
          const scale = viewportScale;
          canvas.width = w * scale;
          canvas.height = h * scale;
          const ctx = canvas.getContext('2d');

          const renderTask = await pdfjsLib.getDocument({ data: await page.file.arrayBuffer() }).promise
            .then(doc => doc.getPage(page.pageIndex + 1))
            .then(pdfPage => pdfPage.render({ canvasContext: ctx, viewport: pdfPage.getViewport({ scale }) }).promise);

          const imgData = canvas.toDataURL('image/png');
          const embeddedImage = await mergedPdf.embedPng(imgData);

          const newPage = mergedPdf.addPage([w, h]);
          newPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: w,
            height: h,
          });
          continue;
        }


        const scale = optimizeCanvas
          ? Math.min(MAX_WIDTH / w, MAX_HEIGHT / h, 1)
          : 1;

        if (scale < 1) {
          const newWidth = w * scale;
          const newHeight = h * scale;
          const newPage = mergedPdf.addPage([newWidth, newHeight]);

          const embeddedPage = await mergedPdf.embedPage(srcPage);
          newPage.drawPage(embeddedPage, {
            x: 0,
            y: 0,
            xScale: scale,
            yScale: scale,
          });

          continue; // skip adding unscaled copy
        }

        const [copiedPage] = await mergedPdf.copyPages(srcPdf, [page.pageIndex]);
        if (page.rotation) {
          copiedPage.setRotation(degrees(page.rotation));
        }
        mergedPdf.addPage(copiedPage);
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Merge failed:', err);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container ref={containerRef} maxWidth="md" sx={{ py: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4">Free2PDF</Typography>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="body2">Dark Mode</Typography>
            <Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
          </Stack>
        </Stack>

        {view === 'upload' && (
          <Paper
            {...getRootProps()}
            sx={{ border: '2px dashed #888', p: 4, textAlign: 'center', cursor: 'pointer', mb: 4 }}
          >
            <input {...getInputProps()} />
            <Typography variant="body1">Drag and drop PDF files here, or click to select files</Typography>
          </Paper>
        )}

        {view === 'reorder' && (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch" mb={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Thumbnail size:</Typography>
                <IconButton onClick={() => setScale((s) => Math.max(0.1, s - 0.1))}><RemoveIcon /></IconButton>
                <IconButton onClick={() => setScale((s) => Math.min(3.0, s + 0.1))}><AddIcon /></IconButton>
                <Button variant="outlined" size="small" onClick={() => setScale(1.0)} disabled={scale === 1.0}>
                  Reset Size
                </Button>
              </Stack>
              <Button onClick={rotateSelected} disabled={selectedPages.length === 0} startIcon={<RotateRightIcon />}>
                Rotate Selected
              </Button>
              <Button onClick={deleteSelected} disabled={selectedPages.length === 0}>
                Delete Selected
              </Button>
              <Button onClick={clearSelection} disabled={selectedPages.length === 0}>
                Clear Selection
              </Button>
            </Stack>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={pdfPages.map(page => page.id)} strategy={rectSortingStrategy}>
                <Grid container spacing={2} columns={{ xs: 4, sm: 8, md: 12 }} justifyContent={"left"}>
                  {pdfPages.map((page) => {
                    const isBeingDragged =
                      activeId &&
                      selectedPages.includes(activeId) &&
                      selectedPages.includes(page.id);
                    if (isBeingDragged) return null;

                    return (
                      <SortableItem
                        key={page.id}
                        id={page.id}
                        page={page}
                        scale={scale}
                        selected={selectedPages.includes(page.id)}
                        onSelect={toggleSelection}
                        containerWidth={containerWidth}
                      />
                    );
                  })}
                </Grid>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId && selectedPages.length > 0 && activeDraggedPages.length > 0 && (
                  <DragPreviewGroup pages={activeDraggedPages} scale={scale} />
                )}
              </DragOverlay>            </DndContext>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={3} alignItems="center">
              <Tooltip title="Resize pages to standard dimensions (8.5 x 11 in). Highly recommended to keep this on." disableHoverListener={isMobile}>
                <FormControlLabel
                  control={<Switch checked={optimizeCanvas} onChange={() => setOptimizeCanvas(!optimizeCanvas)} />}
                  label="Optimize for Canvas"
                />
              </Tooltip>
              {isMobile && (
                <Typography variant="caption" color="textSecondary" sx={{ maxWidth: 250 }}>
                  Resize pages to standard dimensions (8.5 x 11 in). Highly recommended to keep this on.
                </Typography>
              )}
              <Tooltip title="Render each page as an image to remove interactive links. May reduce quality and remove annotations. Use this if your writing disappears after merging." disableHoverListener={isMobile}>
                <FormControlLabel
                  control={<Switch checked={flattenPages} onChange={() => setFlattenPages(!flattenPages)} />}
                  label="Strip links and flatten"
                />
              </Tooltip>
              {isMobile && (
                <Typography variant="caption" color="textSecondary" sx={{ maxWidth: 250 }}>
                  Render each page as an image to remove interactive links. May reduce quality and remove annotations.
                </Typography>
              )}
              <Button variant="outlined" onClick={() => setView('upload')}>Add More PDFs</Button>
              <Button variant="contained" color="primary" onClick={mergeAndDownload}>Merge & Download</Button>
            </Stack>
          </>
        )}
      </Container>
    </ThemeProvider>
  );
}