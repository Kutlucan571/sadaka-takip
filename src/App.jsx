import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

const VARSAYILAN_TEMSILCILIKLER = [
  {ad:"Temsilcilik 1", cinsiyet:"E"},
  {ad:"Temsilcilik 2", cinsiyet:"E"},
  {ad:"Temsilcilik 3", cinsiyet:"E"},
  {ad:"Temsilcilik 4", cinsiyet:"E"},
  {ad:"Temsilcilik 5", cinsiyet:"E"},
  {ad:"Temsilcilik 6", cinsiyet:"E"},
  {ad:"Temsilcilik 7", cinsiyet:"E"},
  {ad:"Temsilcilik 8", cinsiyet:"E"},
  {ad:"Temsilcilik 9", cinsiyet:"E"},
  {ad:"Temsilcilik 10", cinsiyet:"H"},
  {ad:"Temsilcilik 11", cinsiyet:"H"},
  {ad:"Temsilciyet 12", cinsiyet:"H"},
  {ad:"Temsilcilik 13", cinsiyet:"H"},
  {ad:"Temsilcilik 14", cinsiyet:"H"},
  {ad:"Temsilcilik 15", cinsiyet:"H"},
  {ad:"Temsilcilik 16", cinsiyet:"H"},
  {ad:"Temsilcilik 17", cinsiyet:"H"},
];

const ERKEK_RENK = "#38bdf8";   // mavi
const HANIM_RENK = "#f472b6";   // pembe
const ERKEK_BG   = "#0c1f30";
const HANIM_BG   = "#2a1025";

function loadData() { try { const r=localStorage.getItem("sadaka_v3"); return r?JSON.parse(r):{}; } catch { return {}; } }
function saveData(d) { try { localStorage.setItem("sadaka_v3",JSON.stringify(d)); } catch {} }
function loadTemsilcilikler() { try { const r=localStorage.getItem("sadaka_tems_v3"); return r?JSON.parse(r):[...VARSAYILAN_TEMSILCILIKLER]; } catch { return [...VARSAYILAN_TEMSILCILIKLER]; } }
function saveTemsilcilikler(v) { try { localStorage.setItem("sadaka_tems_v3",JSON.stringify(v)); } catch {} }
function ayKey(ay,yil) { return `${yil}-${String(ay+1).padStart(2,"0")}`; }
function oncekiAyKey(ay,yil) { return ay===0?ayKey(11,yil-1):ayKey(ay-1,yil); }
function formatTL(val) {
  const n=Number(val);
  if(!val&&val!==0||isNaN(n)) return "—";
  return n.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺";
}
function Trend({val,prev}) {
  const a=Number(val),b=Number(prev);
  if((!val&&val!==0)||(!prev&&prev!==0)) return null;
  const fark=a-b;
  if(fark===0) return <span style={{color:"#64748b",fontSize:11}}>= Aynı</span>;
  const renk=fark>0?"#10b981":"#ef4444";
  const pct=b>0?(Math.abs(fark/b)*100).toFixed(1):null;
  return <span style={{color:renk,fontSize:11,fontWeight:700}}>{fark>0?"▲":"▼"}{pct?` %${pct}`:""}</span>;
}

function CinsiyetRozeti({cinsiyet, kucuk}) {
  const e = cinsiyet==="E";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      background: e?`${ERKEK_RENK}22`:`${HANIM_RENK}22`,
      color: e?ERKEK_RENK:HANIM_RENK,
      border: `1px solid ${e?ERKEK_RENK:HANIM_RENK}55`,
      borderRadius:6, padding: kucuk?"1px 6px":"2px 9px",
      fontSize: kucuk?10:12, fontWeight:700, letterSpacing:.5,
      minWidth: kucuk?18:24, textAlign:"center"
    }}>
      {e?"E":"H"}
    </span>
  );
}

export default function App() {
  const bugun = new Date();
  const BU_AY = bugun.getMonth();
  const BU_YIL = bugun.getFullYear();

  const [ekran, setEkran] = useState("dashboard");
  const [veriler, setVeriler] = useState(loadData);
  const [temsilcilikler, setTemsilcilikler] = useState(loadTemsilcilikler);
  const [secilenAy, setSecilenAy] = useState(BU_AY);
  const [secilenYil, setSecilenYil] = useState(BU_YIL);
  const [form, setForm] = useState(null);
  const [not, setNot] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [duzenle, setDuzenle] = useState(false);
  const [gecmisAy, setGecmisAy] = useState(BU_AY);
  const [gecmisYil, setGecmisYil] = useState(BU_YIL);
  const [dashGrup, setDashGrup] = useState("tumu"); // tumu | erkek | hanim

  const key = ayKey(secilenAy, secilenYil);
  const yilSecenekleri = [];
  for(let y=BU_YIL-3;y<=BU_YIL+1;y++) yilSecenekleri.push(y);

  useEffect(() => {
    const mevcut = veriler[key];
    if(mevcut) {
      setForm(mevcut.kayitlar.map((k,i)=>({...k,...temsilcilikler[i]})));
      setNot(mevcut.not||"");
    } else {
      setForm(temsilcilikler.map(t=>({...t,kutular:"",tutar:""})));
      setNot("");
    }
  }, [key]);

  function goster(txt){setMesaj(txt);setTimeout(()=>setMesaj(""),2500);}

async function kaydet() {
    // 1. Veriyi Supabase formatına hazırla
    const gonderilecekVeri = form.map((k) => ({
      donem: key,
      temsilcilik: k.ad,
      cinsiyet: k.cinsiyet,
      kutular: Number(k.kutular) || 0,
      tutar: Number(k.tutar) || 0
    })).filter(k => k.kutular > 0 || k.tutar > 0);

    if (gonderilecekVeri.length === 0) {
      goster("⚠️ Kaydedilecek veri yok");
      return;
    }

    // 2. Önce bu aya ait eski kayıtları temizle (Çift kayıt olmasın)
    await supabase.from('kayitlar').delete().eq('donem', key);

    // 3. Yeni verileri Supabase'e gönder
    const { error } = await supabase
      .from('kayitlar')
      .insert(gonderilecekVeri);

    if (error) {
      console.error(error);
      goster("❌ Hata: " + error.message);
    } else {
      // 4. Local'i de güncel tut (Hız için)
      const yeni = { ...veriler, [key]: { kayitlar: form, not, tarih: new Date().toISOString() } };
      setVeriler(yeni);
      saveData(yeni);
      goster("🚀 Buluta Kaydedildi!");
    }}
  
  function tKaydet() {
    saveTemsilcilikler(temsilcilikler);
    setDuzenle(false);
    goster("✓ Temsilcilikler güncellendi");
  }

  // Grup hesaplamaları için yardımcı
  function grupHesapla(veri, cinsiyet) {
    if(!veri) return {kutu:0, tutar:0, sayac:0};
    return veri.kayitlar.reduce((acc,k,i)=>{
      const c = temsilcilikler[i]?.cinsiyet || k.cinsiyet;
      if(!cinsiyet || c===cinsiyet) {
        acc.kutu += Number(k.kutular)||0;
        acc.tutar += Number(k.tutar)||0;
        if((k.kutular||k.tutar) && (k.kutular!==""||k.tutar!=="")) acc.sayac++;
      }
      return acc;
    },{kutu:0,tutar:0,sayac:0});
  }

  // Dashboard verileri
  const buAyKey = ayKey(BU_AY,BU_YIL);
  const buAyVeri = veriler[buAyKey];
  const oncVeri = veriler[oncekiAyKey(BU_AY,BU_YIL)];

  const toplamE = grupHesapla(buAyVeri,"E");
  const toplamH = grupHesapla(buAyVeri,"H");
  const toplamT = {kutu:toplamE.kutu+toplamH.kutu, tutar:toplamE.tutar+toplamH.tutar};
  const oncE = grupHesapla(oncVeri,"E");
  const oncH = grupHesapla(oncVeri,"H");

  // Sıralı liste (dashboard)
  function getSirali(cinsiyet) {
    if(!buAyVeri) return [];
    return buAyVeri.kayitlar
      .map((k,i)=>({...k, ad:temsilcilikler[i]?.ad||k.ad, cinsiyet:temsilcilikler[i]?.cinsiyet||k.cinsiyet, idx:i}))
      .filter(k=>(!cinsiyet||k.cinsiyet===cinsiyet) && (k.tutar!==""||k.kutular!==""))
      .sort((a,b)=>(Number(b.tutar)||0)-(Number(a.tutar)||0));
  }

  const kayitliAylar = Object.keys(veriler).sort().reverse();
  const gecmisKey = ayKey(gecmisAy,gecmisYil);
  const gecmisVeri = veriler[gecmisKey];

  const S = {
    app:{minHeight:"100vh",background:"#f1f5f9",color:"#1e293b",fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column"},
    hdr:{background:"#ffffff",borderBottom:"2px solid #e2e8f0",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
    logo:{fontSize:18,fontWeight:800,color:"#0f172a",letterSpacing:-.5},
    sub:{fontSize:11,color:"#64748b",marginTop:2},
    nav:{display:"flex",gap:4},
    nb:(a)=>({padding:"7px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:a?"#38bdf815":"transparent",color:a?"#0284c7":"#64748b",transition:"all .15s"}),
    main:{flex:1,padding:"18px 14px",maxWidth:1000,margin:"0 auto",width:"100%",boxSizing:"border-box"},
    card:{background:"#ffffff",borderRadius:12,border:"1px solid #e2e8f0",padding:16,marginBottom:12,boxShadow:"0 4px 6px -1px rgb(0 0 0 / 0.1)"},
    sg:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10,marginBottom:16},
    sc:(c,dim)=>({background:"#ffffff",borderRadius:10,border:`1px solid #e2e8f0`,padding:"13px 16px",borderLeft:`5px solid ${c}`,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}),
    sv:{fontSize:22,fontWeight:800,marginBottom:3,color:"#0f172a"},
    sl:{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:.6,marginBottom:3,fontWeight:600},
    st:{fontSize:13,fontWeight:700,color:"#334155",marginBottom:11,display:"flex",alignItems:"center",gap:6},
    tbl:{width:"100%",borderCollapse:"collapse",fontSize:13},
    th:(c)=>({textAlign:"left",padding:"10px",color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:.5,borderBottom:"2px solid #f1f5f9",background:"#f8fafc"}),
    td:{padding:"10px",borderBottom:"1px solid #f1f5f9",verticalAlign:"middle"},
    inp:{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:6,color:"#1e293b",padding:"8px",fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"},
    ta:{background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,color:"#1e293b",padding:"10px",fontSize:13,width:"100%",outline:"none",resize:"vertical",minHeight:75,fontFamily:"inherit",boxSizing:"border-box"},
    btn:(c="#38bdf8")=>({background:c,color:"#ffffff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 2px 4px rgba(0,0,0,0.1)"}),
    bto:{background:"transparent",color:"#0284c7",border:"1px solid #cbd5e1",borderRadius:8,padding:"6px 13px",fontSize:13,cursor:"pointer",fontWeight:500},
    sel:{background:"#ffffff",border:"1px solid #cbd5e1",borderRadius:8,color:"#1e293b",padding:"6px 10px",fontSize:13,cursor:"pointer"},
    ays:{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"},
    flt:{position:"fixed",bottom:18,right:18,background:"#10b981",color:"#fff",padding:"10px 20px",borderRadius:10,fontWeight:700,fontSize:13,zIndex:999,boxShadow:"0 10px 15px -3px rgba(16, 185, 129, 0.3)"},
    gbtn:(a,c)=>({padding:"6px 14px",borderRadius:7,border:`1px solid ${a?c:"#cbd5e1"}`,cursor:"pointer",fontSize:12,fontWeight:700,background:a?c:"#ffffff",color:a?"#ffffff":c,transition:"all .15s"}),
    bdg:(c)=>({display:"inline-block",background:c+"15",color:c,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,border:`1px solid ${c}30`}),
  };

  function GrupTablo({cinsiyet}) {
    const liste = getSirali(cinsiyet);
    const renk = cinsiyet==="E"?ERKEK_RENK:HANIM_RENK;
    const bg = cinsiyet==="E"?ERKEK_BG:HANIM_BG;
    const baslik = cinsiyet==="E"?"👨 Erkek Temsilcilikler":"👩 Hanım Temsilcilikler";
    const top = cinsiyet==="E"?toplamE:toplamH;
    const oncTop = cinsiyet==="E"?oncE:oncH;
    if(liste.length===0) return (
      <div style={{...S.card,borderLeft:`3px solid ${renk}44`,opacity:.5}}>
        <div style={{...S.st,color:renk}}>{baslik}</div>
        <div style={{fontSize:12,color:"#334155"}}>Veri girilmedi</div>
      </div>
    );
    return (
      <div style={{...S.card,borderLeft:`3px solid ${renk}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{...S.st,color:renk,margin:0}}>{baslik}</div>
          <div style={{display:"flex",gap:16,fontSize:12}}>
            <span style={{color:"#64748b"}}>{top.kutu} kutu · <span style={{color:renk,fontWeight:700}}>{formatTL(top.tutar)}</span></span>
            <Trend val={top.tutar} prev={oncTop.tutar}/>
          </div>
        </div>
        <table style={S.tbl}>
          <thead><tr>
            <th style={S.th(renk)}>#</th>
            <th style={S.th(renk)}>Temsilcilik</th>
            <th style={S.th(renk)}>Kutu</th>
            <th style={S.th(renk)}>Tutar</th>
            <th style={S.th(renk)}>Geçen Aya Göre</th>
          </tr></thead>
          <tbody>{liste.map((k,i)=>{
            const onc=oncVeri?.kayitlar[k.idx];
            return (
              <tr key={k.idx} style={{background:i===0?bg+"88":i<3?bg+"44":"transparent"}}>
                <td style={S.td}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":<span style={{color:"#334155"}}>{i+1}</span>}</td>
                <td style={{...S.td,fontWeight:600,color:"#f1f5f9"}}>{k.ad}</td>
                <td style={S.td}>{k.kutular||"—"}</td>
                <td style={{...S.td,color:renk,fontWeight:700}}>{formatTL(k.tutar)}</td>
                <td style={S.td}>{onc?<Trend val={k.tutar} prev={onc.tutar}/>:<span style={{color:"#1a2a40"}}>—</span>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <header style={S.hdr}>
        <div>
          <div style={S.logo}>🕌 Sadaka Kutusu Takip</div>
          <div style={S.sub}>17 Temsilcilik · Merkezi Sayım</div>
        </div>
        <nav style={S.nav}>
          {[["dashboard","📊 Özet"],["veriGir","📝 Veri Gir"],["gecmis","📅 Geçmiş"],["ayarlar","⚙️ Ayarlar"]].map(([id,lbl])=>(
            <button key={id} style={S.nb(ekran===id)} onClick={()=>setEkran(id)}>{lbl}</button>
          ))}
        </nav>
      </header>

      <main style={S.main}>

        {/* ── DASHBOARD ── */}
        {ekran==="dashboard" && <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#f1f5f9",margin:0}}>
              {AYLAR[BU_AY]} {BU_YIL} — Genel Özet
            </h2>
            <div style={{display:"flex",gap:6}}>
              <button style={S.gbtn(dashGrup==="tumu","#94a3b8")} onClick={()=>setDashGrup("tumu")}>Tümü</button>
              <button style={S.gbtn(dashGrup==="erkek",ERKEK_RENK)} onClick={()=>setDashGrup("erkek")}>👨 Erkek</button>
              <button style={S.gbtn(dashGrup==="hanim",HANIM_RENK)} onClick={()=>setDashGrup("hanim")}>👩 Hanım</button>
            </div>
          </div>

          {/* Stat kartları */}
          <div style={S.sg}>
            {(dashGrup==="tumu"||dashGrup==="erkek") && <>
              <div style={S.sc(ERKEK_RENK)}>
                <div style={S.sl}>Erkek · Toplam Kutu</div>
                <div style={{...S.sv,color:ERKEK_RENK}}>{toplamE.kutu}</div>
                <Trend val={toplamE.kutu} prev={oncE.kutu}/>
              </div>
              <div style={S.sc(ERKEK_RENK)}>
                <div style={S.sl}>Erkek · Toplam Tutar</div>
                <div style={{...S.sv,color:ERKEK_RENK}}>{formatTL(toplamE.tutar)}</div>
                <Trend val={toplamE.tutar} prev={oncE.tutar}/>
              </div>
            </>}
            {(dashGrup==="tumu"||dashGrup==="hanim") && <>
              <div style={S.sc(HANIM_RENK)}>
                <div style={S.sl}>Hanım · Toplam Kutu</div>
                <div style={{...S.sv,color:HANIM_RENK}}>{toplamH.kutu}</div>
                <Trend val={toplamH.kutu} prev={oncH.kutu}/>
              </div>
              <div style={S.sc(HANIM_RENK)}>
                <div style={S.sl}>Hanım · Toplam Tutar</div>
                <div style={{...S.sv,color:HANIM_RENK}}>{formatTL(toplamH.tutar)}</div>
                <Trend val={toplamH.tutar} prev={oncH.tutar}/>
              </div>
            </>}
            {dashGrup==="tumu" && <div style={S.sc("#a78bfa")}>
              <div style={S.sl}>Genel Toplam</div>
              <div style={{...S.sv,color:"#a78bfa"}}>{formatTL(toplamT.tutar)}</div>
              <Trend val={toplamT.tutar} prev={oncE.tutar+oncH.tutar}/>
            </div>}
          </div>

          {!buAyVeri && (
            <div style={{...S.card,textAlign:"center",padding:36,color:"#334155"}}>
              <div style={{fontSize:34,marginBottom:8}}>📭</div>
              <div style={{fontSize:13,marginBottom:12}}>Bu ay için henüz veri girilmedi.</div>
              <button style={S.btn()} onClick={()=>setEkran("veriGir")}>Veri Girişi →</button>
            </div>
          )}

          {buAyVeri && <>
            {(dashGrup==="tumu"||dashGrup==="erkek") && <GrupTablo cinsiyet="E"/>}
            {(dashGrup==="tumu"||dashGrup==="hanim") && <GrupTablo cinsiyet="H"/>}
          </>}

          {oncVeri?.not && (
            <div style={{...S.card,borderLeft:"3px solid #f59e0b"}}>
              <div style={{fontSize:10,color:"#f59e0b",marginBottom:4,fontWeight:700}}>📌 GEÇEN AY NOTU</div>
              <div style={{fontSize:13,color:"#cbd5e1"}}>{oncVeri.not}</div>
            </div>
          )}
          {buAyVeri?.not && (
            <div style={{...S.card,borderLeft:"3px solid #38bdf8"}}>
              <div style={{fontSize:10,color:"#38bdf8",marginBottom:4,fontWeight:700}}>📝 BU AYIN DEĞERLENDİRMESİ</div>
              <div style={{fontSize:13,color:"#cbd5e1"}}>{buAyVeri.not}</div>
            </div>
          )}
        </>}

        {/* ── VERİ GİR ── */}
        {ekran==="veriGir" && form && <>
          <div style={S.ays}>
            <span style={{color:"#475569",fontWeight:600,fontSize:12}}>Dönem:</span>
            <select style={S.sel} value={secilenAy} onChange={e=>setSecilenAy(Number(e.target.value))}>
              {AYLAR.map((a,i)=><option key={i} value={i}>{a}</option>)}
            </select>
            <select style={S.sel} value={secilenYil} onChange={e=>setSecilenYil(Number(e.target.value))}>
              {yilSecenekleri.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            {veriler[key] && <span style={S.bdg("#10b981")}>✓ Kayıtlı</span>}
          </div>

          {["E","H"].map(cins=>{
            const renk=cins==="E"?ERKEK_RENK:HANIM_RENK;
            const baslik=cins==="E"?"👨 Erkek Temsilcilikler":"👩 Hanım Temsilcilikler";
            const liste=form.map((k,i)=>({...k,idx:i})).filter(k=>temsilcilikler[k.idx]?.cinsiyet===cins);
            const onKey=oncekiAyKey(secilenAy,secilenYil);
            const grupTop=liste.reduce((s,k)=>({kutu:s.kutu+(Number(k.kutular)||0),tutar:s.tutar+(Number(k.tutar)||0)}),{kutu:0,tutar:0});
            return (
              <div key={cins} style={{...S.card,borderLeft:`3px solid ${renk}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{...S.st,color:renk,margin:0}}>{baslik}</div>
                  <div style={{fontSize:12,color:renk,fontWeight:700}}>{grupTop.kutu} kutu · {formatTL(grupTop.tutar)}</div>
                </div>
                <div style={{overflowX:"auto"}}>
                <table style={S.tbl}>
                  <thead><tr>
                    <th style={S.th(renk)}>Temsilcilik</th>
                    <th style={S.th(renk)}>Kutu Adedi</th>
                    <th style={S.th(renk)}>Tutar (₺)</th>
                    <th style={S.th(renk)}>Geçen Ay</th>
                  </tr></thead>
                  <tbody>{liste.map(k=>{
                    const onc=veriler[onKey]?.kayitlar[k.idx];
                    return (
                      <tr key={k.idx}>
                        <td style={{...S.td,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap"}}>{temsilcilikler[k.idx]?.ad||k.ad}</td>
                        <td style={{...S.td,minWidth:90}}>
                          <input style={S.inp} type="number" min="0" placeholder="0" value={k.kutular}
                            onChange={e=>{const n=[...form];n[k.idx]={...n[k.idx],kutular:e.target.value};setForm(n);}}/>
                        </td>
                        <td style={{...S.td,minWidth:120}}>
                          <input style={S.inp} type="number" min="0" step="0.01" placeholder="0.00" value={k.tutar}
                            onChange={e=>{const n=[...form];n[k.idx]={...n[k.idx],tutar:e.target.value};setForm(n);}}/>
                        </td>
                        <td style={{...S.td,whiteSpace:"nowrap"}}>
                          {onc?<span style={{color:"#334155",fontSize:11}}>{onc.kutular||0} kutu · {formatTL(onc.tutar)}</span>:<span style={{color:"#1a2a40"}}>—</span>}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                  <tfoot><tr>
                    <td style={{...S.td,fontWeight:800,color:renk,fontSize:12}}>GRUP TOPLAMI</td>
                    <td style={{...S.td,fontWeight:800,color:renk}}>{grupTop.kutu}</td>
                    <td style={{...S.td,fontWeight:800,color:renk}}>{formatTL(grupTop.tutar)}</td>
                    <td style={S.td}></td>
                  </tr></tfoot>
                </table>
                </div>
              </div>
            );
          })}

          <div style={S.card}>
            <div style={{...S.st,marginBottom:8}}>📌 Aylık Değerlendirme Notu</div>
            <textarea style={S.ta}
              placeholder="Bu ayki farklılıkların nedenleri, dikkat çeken durumlar, özel notlar..."
              value={not} onChange={e=>setNot(e.target.value)}/>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:"#334155"}}>
              Toplam: {form.reduce((s,k)=>s+(Number(k.kutular)||0),0)} kutu · {formatTL(form.reduce((s,k)=>s+(Number(k.tutar)||0),0))}
            </div>
            <button style={S.btn()} onClick={kaydet}>💾 Kaydet</button>
          </div>
        </>}

        {/* ── GEÇMİŞ ── */}
        {ekran==="gecmis" && <>
          <div style={S.ays}>
            <span style={{color:"#475569",fontWeight:600,fontSize:12}}>Dönem:</span>
            <select style={S.sel} value={gecmisAy} onChange={e=>setGecmisAy(Number(e.target.value))}>
              {AYLAR.map((a,i)=><option key={i} value={i}>{a}</option>)}
            </select>
            <select style={S.sel} value={gecmisYil} onChange={e=>setGecmisYil(Number(e.target.value))}>
              {yilSecenekleri.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            {gecmisVeri && <span style={S.bdg("#10b981")}>✓ Kayıtlı</span>}
          </div>

          <div style={S.card}>
            <div style={S.st}>📋 Kayıtlı Dönemler</div>
            {kayitliAylar.length===0
              ? <div style={{fontSize:12,color:"#334155"}}>Henüz kayıt yok.</div>
              : <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {kayitliAylar.map(k=>{
                    const [y,m]=k.split("-");
                    const v=veriler[k];
                    const toplam=v.kayitlar.reduce((s,r)=>s+(Number(r.tutar)||0),0);
                    const aktif=k===gecmisKey;
                    return (
                      <button key={k} onClick={()=>{setGecmisYil(Number(y));setGecmisAy(Number(m)-1);}}
                        style={{background:aktif?"#0f2240":"#070d1a",border:`1px solid ${aktif?"#38bdf8":"#1a2a40"}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",color:aktif?"#38bdf8":"#475569",fontSize:12,textAlign:"left"}}>
                        {AYLAR[Number(m)-1]} {y}
                        <span style={{display:"block",fontSize:10,color:"#334155",marginTop:1}}>{formatTL(toplam)}</span>
                      </button>
                    );
                  })}
                </div>
            }
          </div>

          {gecmisVeri ? <>
            {["E","H"].map(cins=>{
              const renk=cins==="E"?ERKEK_RENK:HANIM_RENK;
              const baslik=cins==="E"?"👨 Erkek Temsilcilikler":"👩 Hanım Temsilcilikler";
              const oncKey=gecmisAy===0?ayKey(11,gecmisYil-1):ayKey(gecmisAy-1,gecmisYil);
              const liste=gecmisVeri.kayitlar
                .map((k,i)=>({...k,ad:temsilcilikler[i]?.ad||k.ad,cinsiyet:temsilcilikler[i]?.cinsiyet||k.cinsiyet,idx:i}))
                .filter(k=>k.cinsiyet===cins && (k.tutar!==""||k.kutular!==""));
              if(liste.length===0) return null;
              const grupTop=liste.reduce((s,k)=>({kutu:s.kutu+(Number(k.kutular)||0),tutar:s.tutar+(Number(k.tutar)||0)}),{kutu:0,tutar:0});
              return (
                <div key={cins} style={{...S.card,borderLeft:`3px solid ${renk}`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{...S.st,color:renk,margin:0}}>{baslik}</div>
                    <div style={{fontSize:12,color:renk,fontWeight:700}}>{grupTop.kutu} kutu · {formatTL(grupTop.tutar)}</div>
                  </div>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th(renk)}>Temsilcilik</th>
                      <th style={S.th(renk)}>Kutu</th>
                      <th style={S.th(renk)}>Tutar</th>
                      <th style={S.th(renk)}>Önceki Aya Göre</th>
                    </tr></thead>
                    <tbody>{liste.map((k,i)=>{
                      const onc=veriler[oncKey]?.kayitlar[k.idx];
                      return (
                        <tr key={k.idx} style={{background:i%2===0?"#070d1a08":"transparent"}}>
                          <td style={{...S.td,color:"#94a3b8",fontWeight:600}}>{k.ad}</td>
                          <td style={S.td}>{k.kutular||"—"}</td>
                          <td style={{...S.td,color:renk,fontWeight:700}}>{formatTL(k.tutar)}</td>
                          <td style={S.td}>{onc?<Trend val={k.tutar} prev={onc.tutar}/>:<span style={{color:"#1a2a40"}}>—</span>}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              );
            })}
            {gecmisVeri.not && (
              <div style={{...S.card,borderLeft:"3px solid #f59e0b"}}>
                <div style={{fontSize:10,color:"#f59e0b",marginBottom:4,fontWeight:700}}>📌 DEĞERLENDİRME NOTU</div>
                <div style={{fontSize:13,color:"#cbd5e1"}}>{gecmisVeri.not}</div>
              </div>
            )}
          </> : (
            <div style={{...S.card,textAlign:"center",padding:34,color:"#334155"}}>
              <div style={{fontSize:32,marginBottom:7}}>📭</div>
              <div style={{fontSize:12}}>{AYLAR[gecmisAy]} {gecmisYil} için kayıt bulunamadı.</div>
            </div>
          )}
        </>}

        {/* ── AYARLAR ── */}
        {ekran==="ayarlar" && <>
          <div style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={S.st}>🏢 Temsilcilikler</div>
              {!duzenle
                ? <button style={S.bto} onClick={()=>setDuzenle(true)}>Düzenle</button>
                : <div style={{display:"flex",gap:8}}>
                    <button style={S.btn()} onClick={tKaydet}>Kaydet</button>
                    <button style={S.btn("#ef4444")} onClick={()=>{setTemsilcilikler(loadTemsilcilikler());setDuzenle(false);}}>İptal</button>
                  </div>
              }
            </div>

            {/* Erkek grubu */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:ERKEK_RENK,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <span style={{background:ERKEK_RENK+"22",border:`1px solid ${ERKEK_RENK}44`,borderRadius:6,padding:"2px 8px"}}>👨 ERKEK TEMSİLCİLİKLER</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:7}}>
                {temsilcilikler.map((t,i)=>t.cinsiyet!=="E"?null:(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:7,background:"#070d1a",borderRadius:8,padding:"7px 10px",border:`1px solid ${ERKEK_RENK}22`}}>
                    <span style={{color:"#334155",fontSize:11,minWidth:18,textAlign:"right"}}>{i+1}</span>
                    {duzenle ? <>
                      <input style={{...S.inp,flex:1}} value={t.ad}
                        onChange={e=>{const n=[...temsilcilikler];n[i]={...n[i],ad:e.target.value};setTemsilcilikler(n);}}/>
                      <button onClick={()=>{const n=[...temsilcilikler];n[i]={...n[i],cinsiyet:"H"};setTemsilcilikler(n);}}
                        style={{background:HANIM_RENK+"22",border:`1px solid ${HANIM_RENK}44`,borderRadius:5,padding:"3px 7px",cursor:"pointer",color:HANIM_RENK,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>→ H</button>
                    </> : <span style={{fontSize:13,color:"#e2e8f0",flex:1}}>{t.ad}</span>}
                    <CinsiyetRozeti cinsiyet="E" kucuk/>
                  </div>
                ))}
              </div>
            </div>

            {/* Hanım grubu */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:HANIM_RENK,marginBottom:8}}>
                <span style={{background:HANIM_RENK+"22",border:`1px solid ${HANIM_RENK}44`,borderRadius:6,padding:"2px 8px"}}>👩 HANIM TEMSİLCİLİKLER</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:7}}>
                {temsilcilikler.map((t,i)=>t.cinsiyet!=="H"?null:(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:7,background:"#070d1a",borderRadius:8,padding:"7px 10px",border:`1px solid ${HANIM_RENK}22`}}>
                    <span style={{color:"#334155",fontSize:11,minWidth:18,textAlign:"right"}}>{i+1}</span>
                    {duzenle ? <>
                      <input style={{...S.inp,flex:1}} value={t.ad}
                        onChange={e=>{const n=[...temsilcilikler];n[i]={...n[i],ad:e.target.value};setTemsilcilikler(n);}}/>
                      <button onClick={()=>{const n=[...temsilcilikler];n[i]={...n[i],cinsiyet:"E"};setTemsilcilikler(n);}}
                        style={{background:ERKEK_RENK+"22",border:`1px solid ${ERKEK_RENK}44`,borderRadius:5,padding:"3px 7px",cursor:"pointer",color:ERKEK_RENK,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>→ E</button>
                    </> : <span style={{fontSize:13,color:"#e2e8f0",flex:1}}>{t.ad}</span>}
                    <CinsiyetRozeti cinsiyet="H" kucuk/>
                  </div>
                ))}
              </div>
            </div>

            {duzenle && <div style={{fontSize:11,color:"#334155",marginTop:10}}>💡 "→ H" veya "→ E" butonlarına basarak grubunu değiştirebilirsiniz.</div>}
          </div>

          <div style={S.card}>
            <div style={S.st}>💾 Veri Yönetimi</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
              <button style={S.btn("#10b981")} onClick={()=>{
                const json=JSON.stringify({veriler,temsilcilikler},null,2);
                const blob=new Blob([json],{type:"application/json"});
                const url=URL.createObjectURL(blob);
                const a=document.createElement("a");
                a.href=url;a.download=`sadaka-yedek-${new Date().toISOString().slice(0,10)}.json`;a.click();
              }}>📥 Yedeği İndir (JSON)</button>
              <button style={S.btn("#ef4444")} onClick={()=>{
                if(window.confirm("Tüm veriler silinecek! Emin misiniz?")) {
                  localStorage.removeItem("sadaka_v3");
                  localStorage.removeItem("sadaka_tems_v3");
                  setVeriler({});setTemsilcilikler([...VARSAYILAN_TEMSILCILIKLER]);goster("✓ Veriler silindi");
                }
              }}>🗑️ Tüm Verileri Sil</button>
            </div>
            <div style={{fontSize:11,color:"#334155"}}>Kayıtlı dönem: {kayitliAylar.length} · Tarayıcı localStorage'a kaydedilir</div>
          </div>
        </>}
</main>

{mesaj && (
        <div style={{
          ...S.flt,
          background: mesaj.includes("❌") || mesaj.includes("⚠️") ? "#ef4444" : "#10b981",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)"
        }}>
          {mesaj}
        </div>
      )}
    </div>
  );
}