"""Fill DITCH content into Startcup Lazio 2026 pitch template."""
import zipfile, re, io

def xe(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# For each slide: list of (old_pattern_substring, new_text)
# Pattern matches a substring of the old text to identify which line to replace
SLIDES = {
    1: [
        ("Nome dell", "DITCH"),
    ],
    2: [
        ("Logo, tecnologia", "Piattaforma browser-native: studio live + relay multi-stream + participation engine"),
        ("Titolo (richiama", "DITCH"),
        ("Frase descrittiva", "Vai live una volta. Raggiungi tutti i platform. Porta i tuoi viewer sullo schermo."),
    ],
    3: [
        ("Presentate il problema", "Due problemi strutturali nel live streaming, ancora irrisolti insieme:"),
        ("in modo semplice", "1. Distribuzione frammentata — Twitch, YouTube, TikTok vietano il cross-streaming. Il creator deve scegliere una piattaforma, perdendo il 60-70% del pubblico ad ogni live."),
        ("documentandone", "2. Pubblico passivo — il viewer guarda da una chat che scorre a 200 msg/min. Nessun meccanismo per essere presenti. Nessuna fedeltà da costruire."),
    ],
    4: [
        ("Presentate la", "DITCH è un live studio browser-native con tre capacità in un solo prodotto:"),
        ("in sintesi estrema", "Multi-stream gateway — DITCH fa fan-out a Twitch, YouTube, TikTok, Kick via RTMP. DITCH è l'origin: le restrizioni TOS non si applicano."),
        ("il funzionamento", "Participation engine — qualsiasi viewer clicca un link, accede con la camera, appare live sullo stream in meno di 60s. Non in chat. Sullo schermo. Su tutti i platform."),
        ("gli elementi innovativi", "Unified chat — i messaggi di tutti i platform aggregati in un'unica vista in tempo reale."),
        ("la tecnologia che", "Tech core: canvas compositor proprietario (browser-native, background-safe via Web Worker + Breakout Box API). Startup stream: 4-6s. Sistema in produzione oggi."),
    ],
    5: [
        ("Fornite dati", "Mercato live streaming globale: $1.5B nel 2023 — proiettato $6.8B entro il 2030 (CAGR ~24%)"),
        ("mercato di riferimento", "Creator economy: 50M+ creator attivi globalmente. 2M+ guadagnano da live streaming. Influencer marketing: $24B nel 2024. Creator tools: $4.2B."),
        ("collocazione nel mercato", "Target iniziale: creator mid-tier (1K–100K follower) con pubblico multi-platform. Stima 200K–500K globalmente. Conversione all'1% a €39/mese = €1M+ ARR."),
    ],
    6: [
        ("Fornite dati ed elementi qualitativi/quantitativi per", "Nessun competitor risolve distribuzione + partecipazione insieme:"),
        ("Com", "Restream / Castr: multi-stream video. Nessuna interazione viewer. Pubblico passivo."),
        ("Qual è il vantaggio", "StreamYard: studio browser + multi-stream. Nessuna partecipazione viewer cross-platform."),
        ("Se opportuno", "Twitch / YouTube: ecosistemi chiusi. Non possono mettere un viewer Twitch sullo schermo YouTube. DITCH sì."),
        ("Metrica:", "Vantaggio difendibile: controlliamo l'origin dello stream composito. Nessuna piattaforma può replicare il broadcast cross-platform dei partecipanti dal proprio ecosistema."),
    ],
    7: [
        ("Da cosa monetizzate", "Revenue 1 — SaaS creator: abbonamento mensile €15–99/mese. Tier per n° destinazioni e partecipanti concurrent. Driver principale Year 1."),
        ("Cose vendete", "Revenue 2 — DITCH Ads: primo ad network live partecipativo. Slot sponsorizzato ogni ~30 min, baked nel composite stream, unskippable, cross-platform. CPM target €12–18. Split 60% creator / 40% DITCH. Launch Mese 6+."),
    ],
    8: [
        ("Tracciare", "Ora — prodotto in produzione. Creator beta: acquisizione mid-tier creator via community (Reddit, Discord). | Mese 3 — participant viral loop: ogni viewer on-screen è un advertisement organico. | Mese 6 — DITCH Ads: prima campagna brand direct-sold. | Mese 12 — scala creator network. Transizione verso ad programmatic."),
    ],
    9: [
        ("Quanti fondi", "Fase attuale: pre-revenue, prodotto live in produzione. Cerchiamo supporto Startcup Lazio: mentorship (media tech, creator economy, ad-tech), network verso broadcaster europei e agenzie creator, visibilità per accelerare creator beta e prime conversazioni brand. Round seed: da definire post-mentor."),
    ],
    10: [
        ("Breve descrizione", "Sandesh Chapagain — Co-founder. Engineering Sciences Y1, Università di Roma Tor Vergata. Background backend/infra. Architettura e sviluppo full-stack di DITCH."),
        ("Competenze disponibili", "Stack: TypeScript, Next.js, Fastify, Socket.io, WebRTC (Agora), ffmpeg, Supabase, Vercel, Railway. Prodotto completo in produzione in 13 sessioni di sviluppo."),
    ],
    11: [
        ("Recap", "I creator sono stanchi di scegliere quale pubblico ignorare. I viewer sono stanchi di guardare da una finestra di chat. Abbiamo costruito il prodotto che risolve entrambi — ed è live adesso. Questo è DITCH."),
    ],
}

src = '/home/dex/ditch/Template _Pitch delle idee_SCL 2026.pptx'
dst = '/home/dex/ditch/DITCH_Pitch_SCL2026.pptx'

with zipfile.ZipFile(src, 'r') as zin:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            m = re.match(r'ppt/slides/slide(\d+)\.xml$', item.filename)
            if m:
                slide_num = int(m.group(1))
                rules = SLIDES.get(slide_num, [])
                text = data.decode('utf-8')
                for pattern, new_content in rules:
                    # Find <a:t>...pattern...</a:t> and replace the whole thing
                    rx = re.compile(r'<a:t>([^<]*' + re.escape(pattern) + r'[^<]*)</a:t>')
                    match = rx.search(text)
                    if match:
                        old_tag = match.group(0)
                        new_tag = f'<a:t>{xe(new_content)}</a:t>'
                        text = text.replace(old_tag, new_tag, 1)
                    else:
                        print(f'  WARNING slide {slide_num}: pattern not found: [{pattern}]')
                data = text.encode('utf-8')
            zout.writestr(item, data)
    buf.seek(0)
    with open(dst, 'wb') as f:
        f.write(buf.read())

print('Done:', dst)

# Verify by reading back
print('\nVerification:')
with zipfile.ZipFile(dst, 'r') as z:
    for slide_num in range(1, 12):
        sf = f'ppt/slides/slide{slide_num}.xml'
        if sf not in z.namelist():
            continue
        content = z.read(sf).decode('utf-8')
        paras = re.findall(r'<a:p>(.*?)</a:p>', content, re.DOTALL)
        print(f'\nSlide {slide_num}:')
        for p in paras:
            texts = re.findall(r'<a:t>([^<]*)</a:t>', p)
            full = ''.join(texts).strip()
            if full:
                print(f'  {full[:90]}{"..." if len(full) > 90 else ""}')
