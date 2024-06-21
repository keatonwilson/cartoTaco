import PopupContent from '../components/Card.svelte';
import { filterObjectByKeySubstring } from './dataWrangling';
import mapboxgl from 'mapbox-gl';

export const updateMarkers = (currentSites, map, markers) => {
    if (!Array.isArray(currentSites)) {
      currentSites = [];
    }
    markers.forEach((marker) => marker.remove());
    markers = [];
    if (map && currentSites) {
      currentSites.forEach((site) => {
        // Get menu percentages
        const menuPercs = filterObjectByKeySubstring(site, "perc");

        const marker = new mapboxgl.Marker()
          .setLngLat([site.lon_1, site.lat_1])
          .setPopup(
            new mapboxgl.Popup()
              .setDOMContent(
                createPopupContent({
                  name: site.name,
                  type: site.type,
                  shortDescription: site.short_descrip,
                  longDescription: site.long_descrip,
                  menuItems: menuPercs
                })
              )
          )
          .addTo(map);

        // Adjust popup position on open
        marker.getPopup().on('open', () => {
          adjustPopupPosition(marker.getPopup());
        });

        markers.push(marker);
      });
    }
  };

  function createPopupContent(data) {
    const popupElement = document.createElement('div');
    new PopupContent({
      target: popupElement,
      props: { data },
    });
    return popupElement;
  }

  function adjustPopupPosition(popup) {
    const popupElement = popup._content;
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();

    // Get popup position relative to the map
    const popupLeft = popupRect.left - mapRect.left;
    const popupTop = popupRect.top - mapRect.top;

    // Adjust the popup position if it's off the screen
    let offsetX = 0;
    let offsetY = 0;

    if (popupLeft < 0) {
      offsetX = -popupLeft;
    } else if (popupLeft + popupRect.width > mapRect.width) {
      offsetX = mapRect.width - (popupLeft + popupRect.width);
    }

    if (popupTop < 0) {
      offsetY = -popupTop;
    } else if (popupTop + popupRect.height > mapRect.height) {
      offsetY = mapRect.height - (popupTop + popupRect.height);
    }

    popup.setOffset([offsetX, offsetY]);
  }