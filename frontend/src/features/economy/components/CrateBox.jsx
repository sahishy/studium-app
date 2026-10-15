import LootCrateScene from './LootCrateScene'

// The r3f canvas keeps its default 300x150 intrinsic size unless told to fill,
// which would otherwise pin the crate to the top-left of this box.
const CrateBox = ({ className = '', viewportScale = 1.5, ...props }) => (
    <div className={`relative [&_canvas]:w-full! [&_canvas]:h-full! ${className}`}>
        {/* Give bloom room outside the panel without changing the crate's size or anchor. */}
        <div className='absolute pointer-events-none' style={{ inset: `${-(viewportScale - 1) * 50}%` }}>
            <LootCrateScene {...props} viewportScale={viewportScale} />
        </div>
    </div>
)

export default CrateBox
