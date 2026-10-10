import { forwardRef, useEffect, useRef } from "react";
import { Ellipsis, Search, X } from "lucide-react";
import { Menu, MenuTrigger, MenuPopup } from "../ui/menu";
import { ICON_STROKE } from "../icons.js";

/**
 * SLIM-HEADER: one quiet ~44px glass row for Home.
 *   left : small mark + wordmark (optional tiny badge)
 *   right: optional search icon (expands to an in-bar search field) + "…" menu
 * Menu is the coss/base-ui Menu already in src/components/ui (no new dependency);
 * callers pass MenuItem / MenuSeparator children.
 */
const TopBar = forwardRef(function TopBar(
  {
    title = "Captain Feed",
    badge,
    theme = "light",
    className = "",
    search, // { open, value, onOpen, onClose, onChange, placeholder }
    menuDot = false,
    menuLabel = "More",
    menu,
  },
  ref
) {
  const inputRef = useRef(null);
  const searchOpen = Boolean(search?.open);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <header ref={ref} className={`topbar ${searchOpen ? "is-searching" : ""} ${className}`}>
      {searchOpen ? (
        <div className="topbar__search" role="search">
          <Search size={16} strokeWidth={ICON_STROKE + 0.25} aria-hidden="true" />
          <label className="sr-only" htmlFor="feed-search">
            Search feed
          </label>
          <input
            ref={inputRef}
            id="feed-search"
            type="search"
            placeholder={search.placeholder || "Search"}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                search.onClose();
              }
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button
            type="button"
            className="topbar__btn"
            aria-label="Close search"
            onClick={search.onClose}
          >
            <X size={17} strokeWidth={ICON_STROKE + 0.25} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <div className="topbar__brand">
            <img
              className="topbar__mark"
              src={`${import.meta.env.BASE_URL}icons/${theme === "dark" ? "mark-28-dark.png" : "mark-28-light.png"}`}
              width={22}
              height={22}
              alt=""
            />
            <span className="topbar__title">{title}</span>
            {badge ? <span className="topbar__badge">{badge}</span> : null}
          </div>
          <div className="topbar__actions">
            {search ? (
              <button
                type="button"
                className="topbar__btn"
                aria-label="Search"
                title="Search"
                data-dot={search.value?.trim() ? "true" : undefined}
                onClick={search.onOpen}
              >
                <Search size={17} strokeWidth={ICON_STROKE + 0.25} aria-hidden="true" />
              </button>
            ) : null}
            {menu ? (
              <Menu>
                <MenuTrigger
                  className="topbar__btn"
                  aria-label={menuLabel}
                  title={menuLabel}
                  data-dot={menuDot ? "true" : undefined}
                >
                  <Ellipsis size={18} strokeWidth={ICON_STROKE + 0.5} aria-hidden="true" />
                </MenuTrigger>
                <MenuPopup align="end" sideOffset={8} className="topbar-menu">
                  {menu}
                </MenuPopup>
              </Menu>
            ) : null}
          </div>
        </>
      )}
    </header>
  );
});

export default TopBar;
