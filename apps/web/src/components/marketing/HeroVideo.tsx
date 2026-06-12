// TODO(founder): record a 20 to 30 second muted screen capture of the real
// studio in use, ideally including the moment a viewer is cued onto the
// stream. Export it as h264 mp4 around 1080p with no audio track, save it as
// /public/hero-capture.mp4 plus a poster frame /public/hero-poster.jpg, then
// set FOOTAGE below. Until then the master monitor honestly shows a test
// card with the headline; nothing on the page pretends to be footage.
//
// When footage ships, move the headline out of the master screen (render it
// above the MonitorWall panel) so the video plays unobstructed, and keep the
// poster as the LCP image: preload="none" + poster means the browser paints
// the still immediately and fetches video lazily.
const FOOTAGE: { src: string; poster: string } | null = null;

export default function HeroVideo() {
  if (!FOOTAGE) return null;

  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      src={FOOTAGE.src}
      poster={FOOTAGE.poster}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-label="screen capture of the ditch studio broadcasting to four platforms"
    />
  );
}
