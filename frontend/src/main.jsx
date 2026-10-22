import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {loadImage,renderRoom} from './renderer.js';
import './style.css';

const defaults = () => ({
  floor: {tile:'dior-cheese', scale:1, rotation:0, grout:'#e5dfd2', layout:'grid', face:'mixed'},
  // Wall tiling paused for the floor-only demo.
  // wall: {tile:'dior-berry', scale:1, rotation:0, grout:'#d2d7cc', layout:'grid', face:'mixed'}
});
// Add 'wall' back alongside the backend surface list when wall tiling returns.
const enabledSurfaces = ['floor'];
const groutColors = [
  {name:'Warm ivory', color:'#e5dfd2'}, {name:'Soft grey', color:'#d2d7cc'},
  {name:'Stone', color:'#a69d90'}, {name:'Charcoal', color:'#454b48'}
];

function Icon({name, size=20}) {
  const paths = {
    download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    reset:'M3 10a9 9 0 1 1 2 8M3 4v6h6',
    expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    check:'m5 12 4 4L19 6', close:'m6 6 12 12M6 18 18 6',
    floor:'m3 16 9-5 9 5-9 5-9-5Zm0-5 9-5 9 5',
    wall:'M4 3h16v18H4zM4 9h16M4 15h16M12 3v6M8 9v6m8-6v6m-4 0v6',
    room:'M3 21V7l9-4 9 4v14H3Zm9-18v14m-9 4 9-4 9 4',
    compare:'M12 3v18M8 5H4v14h4m8-14h4v14h-4',
    settings:'M4 7h16M4 17h16M9 4v6m6 4v6',
    grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    arrow:'m9 5 7 7-7 7', rotate:'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
    info:'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.check}/></svg>;
}

function Brand() {
  return <a className="brand" href="/" aria-label="Tile Studio home">
    <span className="brand-mark"><Icon name="grid" size={21}/></span>
    <h1>Tile Studio</h1>
  </a>;
}

async function fetchCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('We couldn’t load the tile library. Please try again.');
  }
  const catalog = await response.json();
  const photos = catalog.rooms.filter(room => room.kind === 'photo');
  return {...catalog, rooms: photos.length ? photos : catalog.rooms};
}

function App() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [roomId, setRoomId] = useState('living');
  const [surface, setSurface] = useState('floor');
  const [design, setDesign] = useState(defaults);
  const [search, setSearch] = useState('');
  const [collection, setCollection] = useState('All collections');
  const [panel, setPanel] = useState('materials');
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(true);
  const [renderAttempt,setRenderAttempt]=useState(0);
  const [notice, setNotice] = useState('');
  const [results,setResults]=useState({});
  const [generating,setGenerating]=useState(false);
  const [aiError,setAiError]=useState('');
  const signature=JSON.stringify({roomId,design});
  const result=results[signature];
  async function generatePreview(){
    if(generating)return;
    const key=signature;setGenerating(true);setAiError('');
    try{
      const response=await fetch('/api/generations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,design})});
      let job=await response.json();if(!response.ok)throw new Error(job.error||'Could not start preview.');
      const end=Date.now()+300000;
      while(job.status==='processing'&&Date.now()<end){
        await new Promise(resolve=>setTimeout(resolve,2000));
        const status=await fetch('/api/generations/'+job.id);if(!status.ok)throw new Error('Could not check preview. Try again to recover it.');job=await status.json();
      }
      if(job.status!=='complete')throw new Error(job.error||'Preview is taking longer than expected. Try again to recover it.');
      setResults(previous=>({...previous,[key]:job.imageUrl}));setNotice('AI preview ready.');
    }catch(e){setAiError(e.message||'Could not generate preview.');}finally{setGenerating(false);}
  }
  const canvas = useRef(), original = useRef(), modal = useRef(), generation = useRef(0);

  useEffect(() => { fetchCatalog().then(data => {setCatalog(data); if(!data.rooms.some(room => room.id === 'living')) setRoomId(data.rooms[0].id);}).catch(e => setError(e.message)); }, []);
  const room = catalog?.rooms.find(r => r.id === roomId);
  const settings = design[surface];
  const selected = catalog?.tiles.find(t => t.id === settings.tile);

  useEffect(() => {
    if (!room) return;
    const current = ++generation.current;
    setBusy(true);
    setError('');
    const after = document.createElement('canvas'), before = document.createElement('canvas');
    Promise.all([
      result ? loadImage(result).then(image=>{after.width=image.naturalWidth;after.height=image.naturalHeight;after.getContext('2d').drawImage(image,0,0);}) : renderRoom(after,room,catalog.tiles,design),
      loadImage(room.image)
    ]).then(([,originalImage]) => {
      if (current !== generation.current) return;
      // Draw directly from the full-resolution source once dimensions are known.
      // Previously this raced the other image and could upscale a 300px canvas.
      before.width=after.width;before.height=after.height;
      before.getContext('2d').drawImage(originalImage,0,0,before.width,before.height);
      for (const [ref, source] of [[canvas, after], [original, before]]) {
        ref.current.width = source.width;
        ref.current.height = source.height;
        ref.current.getContext('2d').drawImage(source, 0, 0);
      }
      setBusy(false);
    }).catch(() => {
      if (current === generation.current) {
        setError('The saved preview could not be displayed. Retry loading it; no new generation is needed.');
        setBusy(false);
      }
    });
    return () => { generation.current++; };
  }, [room, result, design, catalog, renderAttempt]);

  useEffect(() => {
    if (preview && canvas.current) {
      modal.current.showModal();
      const target = modal.current.querySelector('canvas');
      target.width = canvas.current.width;
      target.height = canvas.current.height;
      target.getContext('2d').drawImage(canvas.current, 0, 0);
    } else modal.current?.close();
  }, [preview]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  function update(change) {
    setDesign(previous => ({...previous, [surface]: {...previous[surface], ...change}}));
  }
  function reset() {
    setDesign(defaults());
    setCompare(false);
    setNotice('Room finishes reset.');
  }
  function download() {
    canvas.current.toBlob(blob => {
      if (!blob) { setNotice('Download failed. Please try again.'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tile-studio-design.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Your room design has been downloaded.');
    }, 'image/png');
  }

  if (!catalog) return <div className="loading-page">
    <Brand/>
    <div className="loading-card">
      {!error && <span className="spinner"/>}
      <h1>{error ? 'Let’s try that again' : 'Preparing your workspace'}</h1>
      <p role={error ? 'alert' : 'status'}>{error || 'Loading your rooms and tile collection…'}</p>
      {error && <button className="primary-button" onClick={() => location.reload()}>Retry</button>}
    </div>
  </div>;

  const tiles = catalog.tiles.filter(tile =>
    tile.surfaces.includes(surface) &&
    `${tile.name} ${tile.finish} ${tile.collection}`.toLowerCase().includes(search.toLowerCase()) &&
    (collection === 'All collections' || tile.collection === collection)
  );
  const hasFilters = search || collection !== 'All collections';
  const faceCount = selected.variants?.length || 1;

  return <>
    <header className="app-header">
      <Brand/>
      <span className="workspace-label"><span/> Your material playground</span>
      <div className="header-actions">
        <button className="text-button" onClick={reset} aria-label="Reset design"><Icon name="reset" size={17}/><span>Reset design</span></button>
        <button className="primary-button" onClick={download} disabled={busy || !!error}><Icon name="download" size={17}/><span>Download<span className="desktop-word"> design</span></span></button>
      </div>
    </header>

    <main className="app-shell">
      <nav className="room-rail" aria-label="Choose a room">
        <div className="rail-heading"><Icon name="room" size={17}/><h2>Rooms</h2><span>{catalog.rooms.length}</span></div>
        <div className="room-options">
          {catalog.rooms.map((item, index) => <button key={item.id} className={`room-option ${item.id === roomId ? 'active' : ''}`} onClick={() => setRoomId(item.id)} aria-label={`Room ${index + 1}`} aria-pressed={item.id === roomId}>
            <div className="room-thumbnail">
              <img src={item.image} alt=""/>
              {item.foreground && <img src={item.foreground} alt=""/>}
              {item.id === roomId && <span className="room-check"><Icon name="check" size={12}/></span>}
            </div>
            <div className="room-option-label"><span>Room {index + 1}</span></div>
          </button>)}
        </div>
        <div className="rail-note"><Icon name="info" size={16}/><p>Predefined spaces.<br/>Your choice of finishes.</p></div>
      </nav>

      <section className="studio" aria-label="Room visualizer">
        <div className="studio-heading">
          
          <button className="icon-button preview-button" onClick={() => setPreview(true)} disabled={busy || !!error} aria-label="Open full room preview" title="Full preview"><Icon name="expand"/></button>
        </div>

        <div className="preview-stage">
          <div className="surface-toolbar" aria-label="Choose the surface to edit">
            <span className="surface-label">Apply to</span>
            {enabledSurfaces.map(item => <button key={item} onClick={() => setSurface(item)} className={surface === item ? 'active' : ''} aria-pressed={surface === item}><Icon name={item} size={16}/>{item === 'floor' ? 'Floor' : 'Wall'}</button>)}
          </div>
          <div className="scene-frame" style={{'--room-ratio':result && canvas.current ? canvas.current.width / canvas.current.height : room.width / room.height}}><div className={`scene ${compare ? 'comparing' : ''}`} aria-busy={busy}>
            <canvas ref={canvas} aria-label={`${room.type} with ${catalog.tiles.find(t => t.id === design.floor.tile)?.name} floor`}/>
            <div className="before-layer" style={{clipPath:`inset(0 ${100 - (compare ? split : 0)}% 0 0)`}} aria-hidden={!compare}><canvas ref={original} aria-label="Original room"/></div>
            {compare && <>
              <div className="compare-line" style={{left:`${split}%`}}><span><Icon name="compare" size={18}/></span></div>
              <span className="compare-label before-label">Original</span><span className="compare-label after-label">Your design</span>
              <input className="compare-range" type="range" min="0" max="100" value={split} onChange={e => setSplit(+e.target.value)} aria-label="Before and after comparison"/>
            </>}
            {busy && <div className="render-status" role="status"><span className="spinner"/> Updating preview</div>}
          </div>
          </div><div className="preview-toolbar">
            <span className="sample-label"><span/> {result ? 'AI visualization · approximate appearance' : 'Instant preview · generate for AI refinement'}</span>
            <button className={`compare-toggle ${compare ? 'active' : ''}`} onClick={() => setCompare(value => !value)} aria-pressed={compare}><Icon name="compare" size={16}/><span>Compare</span><span className="toggle-track"/></button>
          </div>
        </div>

        {error && <div className="error-message" role="alert"><span>{error}</span><button onClick={() => setRenderAttempt(value => value+1)}>Retry</button></div>}
      </section>
      <section className="combination" aria-label="Your selected finishes">
        <div className="applied-heading"><h2>Your combination</h2><span>Select a surface to change its finish</span></div>
        <div className="applied-materials">
          {enabledSurfaces.map(item => {
            const tile = catalog.tiles.find(t => t.id === design[item].tile);
            return <button key={item} className={`applied-card ${surface === item ? 'active' : ''}`} onClick={() => setSurface(item)} aria-pressed={surface === item}>
              <img src={tile.thumbnail || tile.image} alt=""/>
              <span className="applied-copy"><small>{item === 'floor' ? 'FLOOR' : 'WALL'}</small><strong>{tile.name}</strong><span>{tile.finish} finish</span></span>
              <Icon name={surface === item ? 'check' : 'arrow'} size={16}/>
            </button>;
          })}
        </div>

      </section>

      <aside className="library" aria-label="Tile library and layout controls">
        <div className="library-heading"><div><h2>Material library</h2></div><span className="material-count">{catalog.tiles.length}</span></div>
        <div className="panel-tabs" aria-label="Library views">
          <button className={panel === 'materials' ? 'active' : ''} onClick={() => setPanel('materials')} aria-pressed={panel === 'materials'}><Icon name="grid" size={16}/> Materials</button>
          <button className={panel === 'layout' ? 'active' : ''} onClick={() => setPanel('layout')} aria-pressed={panel === 'layout'}><Icon name="settings" size={16}/> Layout & finish</button>
        </div>


        {panel === 'materials' ? <>
          <div className="library-filters">
            <label className="search-field"><Icon name="search" size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tiles…" aria-label="Search tiles"/>{search && <button onClick={() => setSearch('')} aria-label="Clear search"><Icon name="close" size={15}/></button>}</label>
            <div className="filter-row"><select value={collection} onChange={e => setCollection(e.target.value)} aria-label="Filter by collection">{['All collections', ...new Set(catalog.tiles.map(tile => tile.collection))].map(item => <option key={item}>{item}</option>)}</select><span className="finish-badge">Matt finish</span></div>
            <div className="result-summary"><span>{tiles.length} {tiles.length === 1 ? 'material' : 'materials'}</span>{hasFilters ? <button onClick={() => {setSearch(''); setCollection('All collections');}}>Clear filters</button> : <span>Click to apply</span>}</div>
          </div>
          <div className="tile-grid" aria-label="Available tiles">
            {tiles.map(tile => <button key={tile.id} className={`tile-card ${tile.id === settings.tile ? 'active' : ''}`} onClick={() => update({tile:tile.id, face:'mixed'})} aria-pressed={tile.id === settings.tile} aria-label={`Apply ${tile.name} to ${surface}`}>
              <div className="tile-swatch"><img src={tile.thumbnail || tile.image} alt="" loading="lazy"/>{tile.id === settings.tile && <span><Icon name="check" size={13}/></span>}</div>
              <strong>{tile.name}</strong><small>{tile.collection}<span>{tile.variants?.length || 1} {(tile.variants?.length || 1) === 1 ? 'face' : 'faces'}</span></small>
            </button>)}
            {!tiles.length && <div className="empty-state"><Icon name="search" size={28}/><h3>No matching tiles</h3><p>Try another name or collection.</p><button className="text-button" onClick={() => {setSearch(''); setCollection('All collections');}}>Clear filters</button></div>}
          </div>
          <button className="layout-shortcut" onClick={() => setPanel('layout')}><span><Icon name="settings" size={17}/> Refine size, pattern & grout</span><Icon name="arrow" size={15}/></button>
        </> : <div className="layout-panel">
          <div className="selected-product"><img src={selected.thumbnail || selected.image} alt={`${selected.name} texture`}/><div><span>SELECTED MATERIAL</span><h3>{selected.name}</h3><p>{selected.finish} · {faceCount} {faceCount === 1 ? 'face' : 'faces'}</p></div></div>
          <div className="setting-group">
            <div className="setting-heading"><label htmlFor="tile-scale">Tile size</label><output htmlFor="tile-scale">{Math.round(selected.widthCm * settings.scale)} × {Math.round(selected.heightCm * settings.scale)} cm</output></div>
            <input id="tile-scale" type="range" min="0.5" max="2" step="0.25" value={settings.scale} onChange={e => update({scale:+e.target.value})}/>
            <div className="scale-ends"><span>Smaller</span><span>Larger</span></div>
            <p className="setting-help">Demo dimensions. Adjust to explore the look.</p>
          </div>
          <div className="setting-group"><div className="setting-heading"><span>Pattern</span></div><div className="pattern-options">
            {['grid', 'brick'].map(item => <button key={item} className={settings.layout === item ? 'active' : ''} onClick={() => update({layout:item})} aria-pressed={settings.layout === item}><span className={`pattern-illustration ${item}`}/>{item === 'grid' ? 'Straight' : 'Brick offset'}</button>)}
          </div></div>
          <div className="setting-group"><div className="setting-heading"><span>Rotation</span><Icon name="rotate" size={16}/></div><div className="rotation-options">{[0,90,180,270].map(value => <button key={value} onClick={() => update({rotation:value})} className={settings.rotation === value ? 'active' : ''} aria-pressed={settings.rotation === value}>{value}°</button>)}</div></div>
          <div className="setting-group"><div className="setting-heading"><span>Grout colour</span><small>{groutColors.find(item => item.color === settings.grout)?.name}</small></div><div className="grout-options">{groutColors.map(item => <button key={item.color} style={{'--grout-color':item.color}} className={settings.grout === item.color ? 'active' : ''} onClick={() => update({grout:item.color})} aria-pressed={settings.grout === item.color} aria-label={`${item.name} grout`} title={item.name}>{settings.grout === item.color && <Icon name="check" size={15}/>}</button>)}</div></div>
          <div className="setting-group"><label className="field-label" htmlFor="tile-face">Texture variation</label><select id="tile-face" value={settings.face} onChange={e => update({face:e.target.value})}><option value="mixed">Mix all available faces</option>{(selected.variants || [selected.image]).map((_,index) => <option key={index} value={String(index)}>Face {index + 1}</option>)}</select><p className="setting-help">Mix faces for a more natural-looking surface.</p></div>
        </div>}
        <div className="ai-controls">
          <p role="status">{generating?'Creating your room preview… This can take a few minutes.':result?(error?'Preview saved. Retry loading the image.':busy?'Loading saved preview…':'Preview matches your current selections.'):'Preview needs updating. Tile sizes are approximate.'}</p>
          {aiError && <p className="ai-error" role="alert">{aiError}</p>}
          <button className="primary-button" onClick={generatePreview} disabled={generating || !!result}>{generating?<><span className="spinner"/> Generating…</>:result?'Preview ready':'Generate preview'}</button>
          <small>AI may vary tile details. Generation uses API credits.</small>
        </div>
      </aside>
    </main>
    {notice && <div className="toast" role="status"><Icon name="check" size={17}/>{notice}</div>}
    <dialog ref={modal} className="preview-dialog" onCancel={() => setPreview(false)} onClose={() => setPreview(false)}>
      <div className="modal-heading"><div><p className="eyebrow">YOUR DESIGN</p><h2>Design preview</h2></div><button className="icon-button" onClick={() => setPreview(false)} aria-label="Close preview"><Icon name="close"/></button></div>
      <canvas aria-label="Full room design preview"/>
      <div className="modal-actions"><span>{room.kind === 'photo' ? 'Photo room' : 'Illustrated room'} · {room.width} × {room.height} px</span><button className="primary-button" onClick={download}><Icon name="download" size={17}/> Download PNG</button></div>
    </dialog>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
