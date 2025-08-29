// --- Simple sample image as a base64 data URL (256×256 checkerboard with gradient-ish look)
    const SAMPLE_DATA_URL = 
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAABt/0V9AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJ'
      + 'bWFnZVJlYWR5ccllPAAABuZJREFUeNrs3cENgkAQBVBb//+mQcb9rQ0q6gVQ7d0l4V3k1JgJc9m9O1fK'
      + 'wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAPh0o6t9s7jz1x2yYxj7yQvF2f0mF5+9x+g8R4f5qf4w7b0zG6h4s1b9b8M0'
      + 'P7k8cB0vZ8b3vZb8r2Q7iY4u3Kx9e9jG8Y8f7eO9nW3m3mX7nZfjcHf9k8cL7m8fH9r8v0k4AAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAP8DBgC3zq4b7x2k1AAAAABJRU5ErkJggg==';

    const $ = (id) => document.getElementById(id);
    const srcCanvas = $('src');
    const dstCanvas = $('dst');
    const sctx = srcCanvas.getContext('2d');
    const dctx = dstCanvas.getContext('2d');

    const presets = [
      { name: 'Identity', k:[0,0,0, 0,1,0, 0,0,0] },
      { name: 'Box Blur', k:[1,1,1, 1,1,1, 1,1,1], autoDivide:true },
      { name: 'Gaussian Blur', k:[1,2,1, 2,4,2, 1,2,1], autoDivide:true },
      { name: 'Sharpen', k:[0,-1,0, -1,5,-1, 0,-1,0] },
      { name: 'Edge Detect (Sobel X)', k:[-1,0,1, -2,0,2, -1,0,1], abs:true },
      { name: 'Edge Detect (Sobel Y)', k:[-1,-2,-1, 0,0,0, 1,2,1], abs:true },
      { name: 'Emboss', k:[-2,-1,0, -1,1,1, 0,1,2], bias:128 },
      { name: 'Outline', k:[0,-1,0, -1,4,-1, 0,-1,0], abs:true }
    ];

    function putKernel(vals) {
      const ids = ['k00','k01','k02','k10','k11','k12','k20','k21','k22'];
      ids.forEach((id,i)=>$(id).value = vals[i]);
    }

    function readKernel() {
      const ids = ['k00','k01','k02','k10','k11','k12','k20','k21','k22'];
      return ids.map(id => parseFloat($(id).value || '0'));
    }

    function drawSample() {
      const img = $('hiddenImg');
      img.onload = ()=> {
        const size = bestFitSize(img.width, img.height, 512, 512);
        [srcCanvas.width, srcCanvas.height] = [size.w, size.h];
        [dstCanvas.width, dstCanvas.height] = [size.w, size.h];
        sctx.drawImage(img, 0, 0, size.w, size.h);
        dctx.drawImage(img, 0, 0, size.w, size.h);
      };
      img.src = '';
      img.src = SAMPLE_DATA_URL;
    }

    function bestFitSize(w, h, maxW, maxH) {
      const r = Math.min(maxW / w, maxH / h);
      return { w: Math.round(w*r), h: Math.round(h*r) };
    }

    $('file').addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev)=>{
        const img = $('hiddenImg');
        img.onload = ()=>{
          const size = bestFitSize(img.width, img.height, 1024, 1024);
          [srcCanvas.width, srcCanvas.height] = [size.w, size.h];
          [dstCanvas.width, dstCanvas.height] = [size.w, size.h];
          sctx.drawImage(img, 0, 0, size.w, size.h);
          dctx.drawImage(img, 0, 0, size.w, size.h);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    $('btnSample').addEventListener('click', drawSample);
    $('btnReset').addEventListener('click', ()=>{
      const img = $('hiddenImg');
      if (!img.src) { drawSample(); return; }
      const size = bestFitSize(img.width, img.height, srcCanvas.width, srcCanvas.height);
      sctx.drawImage(img, 0, 0, size.w, size.h);
      dctx.drawImage(img, 0, 0, size.w, size.h);
      $('stat').textContent = '';
    });

    $('identity').addEventListener('click', ()=> putKernel([0,0,0,0,1,0,0,0,0]));
    $('clear').addEventListener('click', ()=> putKernel([0,0,0,0,0,0,0,0,0]));

    function buildPresetButtons() {
      const wrap = $('presets');
      presets.forEach(p=>{
        const b = document.createElement('button');
        b.textContent = p.name;
        b.addEventListener('click', ()=>{
          putKernel(p.k);
          $('autoDivide').checked = !!p.autoDivide;
          $('bias').value = p.bias ?? 0;
          $('absval').checked = !!p.abs;
          applyFilter();
        });
        wrap.appendChild(b);
      });
    }
    buildPresetButtons();

    $('apply').addEventListener('click', applyFilter);

    function toGrayscale(data) {
      for (let i=0; i<data.length; i+=4) {
        const r=data[i], g=data[i+1], b=data[i+2];
        const y = 0.299*r + 0.587*g + 0.114*b;
        data[i]=data[i+1]=data[i+2]=y;
      }
    }

    function applyFilter() {
      const t0 = performance.now();
      const kernel = readKernel();
      const bias = parseFloat($('bias').value || '0');
      const iters = Math.max(1, parseInt($('iters').value||'1'));
      const autoDivide = $('autoDivide').checked;
      const useGray = $('grayscale').checked;
      const useAbs = $('absval').checked;
      const clamp = $('clamp').checked;

      let src = sctx.getImageData(0,0,srcCanvas.width, srcCanvas.height);
      if (useGray) toGrayscale(src.data);

      let working = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);

      for (let iter=0; iter<iters; iter++) {
        const out = dctx.createImageData(src.width, src.height);
        const w = src.width, h = src.height;
        const sum = kernel.reduce((a,b)=>a+b,0);
        const div = (autoDivide && sum !== 0) ? sum : 1;

        const get = (x,y,c)=>{
          // Clamp at boundaries
          if (x<0) x=0; if (y<0) y=0; if (x>=w) x=w-1; if (y>=h) y=h-1;
          const idx = (y*w + x) * 4 + c;
          return working.data[idx];
        };

        for (let y=0; y<h; y++) {
          for (let x=0; x<w; x++) {
            let r=0,g=0,b=0;
            // Apply 3x3 kernel centered at (x,y)
            let ki=0;
            for (let j=-1; j<=1; j++) {
              for (let i=-1; i<=1; i++) {
                const k = kernel[ki++];
                const xx = x+i, yy = y+j;
                r += k * get(xx,yy,0);
                g += k * get(xx,yy,1);
                b += k * get(xx,yy,2);
              }
            }
            if (useAbs) { r=Math.abs(r); g=Math.abs(g); b=Math.abs(b); }
            r = r/div + bias; g = g/div + bias; b = b/div + bias;
            if (clamp) { r=Math.min(255,Math.max(0,r)); g=Math.min(255,Math.max(0,g)); b=Math.min(255,Math.max(0,b)); }
            const idx = (y*w + x) * 4;
            out.data[idx] = r; out.data[idx+1] = g; out.data[idx+2] = b; out.data[idx+3] = 255;
          }
        }
        working = out; // for next iteration (if any)
      }

      dctx.putImageData(working, 0, 0);
      const t1 = performance.now();
      $('stat').textContent = `Applied in ${(t1 - t0).toFixed(1)} ms (\u00D7${iters})`;
    }

    drawSample();