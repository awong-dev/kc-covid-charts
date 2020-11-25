import { useCallback } from 'react';

const HRAListItem = ({
  hraId,
  active,
  name,
  toggleActive,
  isHovered,
  setHoveredHraId,
}) => {
  const handleChange = useCallback(() => toggleActive(hraId), [hraId]);
  const handleMouseEnter = useCallback(() => setHoveredHraId(hraId), [hraId, setHoveredHraId]);
  const handleMouseLeave = useCallback(() => setHoveredHraId(null), [hraId, setHoveredHraId]);
  return (
    <li
      className={`flex items-stretch justify-items-stretch text-sm ${isHovered && ' bg-yellow-500'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* I think the linter is wrong here — the input is a child of the label and that should
      be fine. */}
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="flex-1 px-2 py-0.5 whitespace-nowrap">
        <input type="checkbox" className="mr-2" checked={active} onChange={handleChange} />
        {name}
      </label>
    </li>
  );
};

export default function HRAList({ state: { hras, hoveredHraId }, toggleActive, setHoveredHraId }) {
  return (
    <ul className="divide-y divide-white bg-gray-100">
      {Object.values(hras).map(({ hraId, name, active }, i) => (
        <HRAListItem
          hraId={hraId}
          name={name}
          active={active}
          toggleActive={toggleActive}
          isHovered={hraId === hoveredHraId}
          setHoveredHraId={setHoveredHraId}
        />
      ))}
    </ul>
  );
}
