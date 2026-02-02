import React from 'react';

const MirroredHtmlContent = React.memo(function MirroredHtmlContent({ renderedHtml, renderedHtmlDimensions, viewportSize }) {
  const refW = renderedHtmlDimensions?.width || 1920;
  const refH = renderedHtmlDimensions?.height || 1080;
  const scale = Math.min(viewportSize.width / refW, viewportSize.height / refH);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: refW * scale, height: refH * scale, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{ width: refW, height: refH, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, fontFamily: "'Heebo', 'Segoe UI', sans-serif" }}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </div>
  );
});

export default MirroredHtmlContent;
