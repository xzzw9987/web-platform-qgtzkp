require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/renderers/SimpleRenderer",
], function (esriConfig, Map, MapView, FeatureLayer, SimpleRenderer) {
  // Initialize a Map instance
  const map = new Map({
    basemap: "gray-vector", // Basemap layer service
  });
  // Initialize a MapView instance
  const view = new MapView({
    map: map,
    center: [-122.59, 45.16], // Longitude, latitude
    zoom: 10, // Zoom level
    container: "viewDiv", // Div element
  });

  // Initialize Layers
  const arcgisLayerUrl =
    "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer";

  const normalLayersUrl = [
    // Links from http://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer
    // countries
    `${arcgisLayerUrl}/3`,
    // states
    `${arcgisLayerUrl}/2`,
    // highways
    `${arcgisLayerUrl}/1`,
  ];
  /**
   * The city layer needs specific config.
   * As the requirements said, the size of the point should conform to the city's population.
   */
  const citiesLayer = new FeatureLayer({
    url: `${arcgisLayerUrl}/0`,
    renderer: new SimpleRenderer({
      symbol: {
        type: "simple-marker",
        color: "grey",
      },
      // https://developers.arcgis.com/javascript/latest/api-reference/esri-renderers-visualVariables-VisualVariable.html
      visualVariables: [
        {
          type: "size",
          field: "pop2000",
          minDataValue: 0,
          maxDataValue: 50 * 10000,
          minSize: 10,
          maxSize: 25,
        },
      ],
    }),
  });
  // Add normal layers and cities layer to the map
  map.addMany(normalLayersUrl.map((url) => new FeatureLayer({ url })));
  map.add(citiesLayer);
  /**
   * Watch view's extent changes
   * Use a debounce function aim to avoid performance issue when dragging/zooming the map
   */
  view.watch(
    "extent",
    debounce(async (extent) => {
      /**
       * Fetch cities' attributes within current extent,
       * Then update the list.
       */
      const listData = await request(0, extent);
      listComponent.clear().addMany(listData);
    })
  );

  function debounce(callback, duration = 200) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => callback(...args), duration);
    };
  }

  /**
   * Create a dom node by data.
   * @param data {Array<String>}
   * @returns {HTMLDivElement}
   */
  function createListNode(data) {
    const node = document.createElement("div");
    node.className = "list-item flex";
    node.innerHTML = data.map((d) => `<div>${d}</div>`).join("");
    node.customData = data;
    return node;
  }

  /**
   * Update node's children and data
   * @param node {HTMLElement}
   * @param data {*}
   * @returns {HTMLElement}
   */
  function updateNode(node, data) {
    Array.from(node.children).forEach(
      (node, idx) => (node.textContent = data[idx])
    );
    node.customData = data;
    return node;
  }

  /**
   * Create a list which is able to reuse item.
   * When it scrolls at the bottom of the domElement,
   * move the items above the top to the end of the list and increase holding element's padding top
   * like this:
   *
   * From:
   *              ---------
   *              |   1   |
   *              |   2   |      -> listWrapper is the child of domElement
   *              |   3   |
   *              |   4   |
   *           ---------------
   *           |  |   5   |  |
   *           |  |   6   |  |   -> domElement with style overflow auto
   *           |  |   7   |  |
   *           |  ---------  |
   *           ---------------
   *
   * To:
   *              ---------
   *              |       |
   *              |padding|      -> Add listWrapper's padding top to compensate the space
   *              |  top  |
   *              |       |
   *           ---------------
   *           |  |   5   |  |
   *           |  |   6   |  |   -> domElement with style overflow auto
   *           |  |   7   |  |
   *           ---------------
   *              | 8(1)  |
   *              | 9(2)  |      -> listWrapper is the child of domElement, item 8 reusing 1's dom node
   *              | 10(3) |
   *              | 11(4) |
   *              ---------
   * When it scrolls at the top of the dom element,
   * reversing the steps. eg: move items below the bottom to the top, and decrease the padding top
   *
   * @param domElement {HTMLElement} The scrolling element
   * @param maxItemsCount {Number}
   * @returns {{onMouseOver(*): this, onLoadMore(*): this, addMany(*): (undefined|this), clear(): this, onMouseLeave(*): this}|*}
   */
  function createListComponent(domElement, maxItemsCount = 30) {
    const listBody = domElement.querySelector(".list-body");
    const listWrapper = document.createElement("div");
    const threshold = 3;
    let listData = [];
    // the top cursor of list data we currently display in listWrapper
    // it's 5 in the previous case
    let firstIndex = 0;
    // the end cursor of list data we currently display in listWrapper
    // it's 11 in the previous case
    let lastIndex = 0;
    let paddingTop = 0;
    let loadMoreCallback = null;
    let mouseOverCallback = null;
    let mouseLeaveCallback = null;
    listWrapper.className = "list-wrapper";
    listBody.appendChild(listWrapper);

    // move node from top to the bottom
    function moveNodeFromTopToBottom() {
      if (listWrapper.childElementCount === 0) return;
      const itemHeight =
        listWrapper.firstElementChild.getBoundingClientRect().height;
      const frag = document.createDocumentFragment();
      // calculate how many items should be moved
      const removeItemsCount = Math.floor(
        (listBody.scrollTop - paddingTop) / itemHeight
      );
      let i = 0;
      while (i < removeItemsCount && listWrapper.firstElementChild) {
        if (lastIndex < listData.length - 1) {
          lastIndex++;
          updateNode(listWrapper.firstElementChild, listData[lastIndex]);
          frag.appendChild(listWrapper.firstElementChild);
          paddingTop += itemHeight;
          firstIndex++;
          i++;
        } else break;
      }
      listWrapper.appendChild(frag);
      // update the padding top
      listWrapper.style.paddingTop = paddingTop + "px";
    }

    // move node from bottom to the top
    function moveNodeFromBottomToTop() {
      if (listWrapper.childElementCount === 0) return;
      const itemHeight =
        listWrapper.firstElementChild.getBoundingClientRect().height;
      const frag = document.createDocumentFragment();
      const removeItemsCount = Math.floor(
        (listBody.scrollHeight - listBody.scrollTop - listBody.offsetHeight) /
        itemHeight
      );
      let i = 0;
      while (i < removeItemsCount && listWrapper.lastElementChild) {
        if (firstIndex > 0) {
          firstIndex--;
          updateNode(listWrapper.lastElementChild, listData[firstIndex]);
          frag.insertBefore(listWrapper.lastElementChild, frag.firstChild);
          paddingTop -= itemHeight;
          lastIndex--;
          i++;
        } else break;
      }
      listWrapper.insertBefore(frag, listWrapper.firstChild);
      listWrapper.style.paddingTop = paddingTop + "px";
    }

    let scrollLocker = false;
    // listen to the scroll event
    listBody.addEventListener("scroll", () => {
      if (scrollLocker) return;
      // scroller hits the bottom edge
      if (
        listBody.scrollTop + listBody.clientHeight >
        listBody.scrollHeight - threshold
      ) {
        moveNodeFromTopToBottom();
        // when it comes to the bottom edge and there is no more data left
        // trigger the loadMore callback order to consume more data
        if (lastIndex === listData.length - 1) {
          scrollLocker = true;
          loadMoreCallback &&
          Promise.resolve(loadMoreCallback(lastIndex)).finally(
            () => (scrollLocker = false)
          );
        }
      } else if (listBody.scrollTop < paddingTop - threshold) {
        // scroller hits the top edge
        moveNodeFromBottomToTop();
      }
    });
    // delegate the mouseover event
    let lastHoverEl = null;
    listWrapper.addEventListener("mouseover", (e) => {
      let el = e.target;
      // find which element contains the binding data
      while (el) {
        if (el.customData && el !== lastHoverEl) {
          lastHoverEl = el;
          // dispatch the event
          mouseOverCallback && mouseOverCallback(el.customData);
          return;
        }
        el = el.parentNode;
      }
    });
    // listen to the mouseleave event
    listWrapper.addEventListener("mouseleave", (e) => {
      lastHoverEl = null;
      mouseLeaveCallback && mouseLeaveCallback();
    });

    return {
      /**
       * Add data to the list.
       * @param data {Array<Array<*>>}
       * @returns {*}
       */
      addMany(data) {
        if (!data.length) return;
        listData.push(...data);
        const frag = document.createDocumentFragment();
        let i = 0;
        /**
         * when the number of existing nodes doesn't satisfy the demand,
         * in this case, it should create dom node when the number of nodes is less than maxItemsCount (eg: 30)
         */
        while (
          i < data.length &&
          lastIndex - firstIndex < maxItemsCount - 1 &&
          lastIndex < listData.length
          ) {
          frag.appendChild(createListNode(data[i]));
          if (
            lastIndex + 1 === firstIndex + maxItemsCount ||
            lastIndex + 1 === listData.length
          )
            break;
          lastIndex++;
          i++;
        }
        listWrapper.appendChild(frag);
        // reuse nodes if possible
        moveNodeFromTopToBottom();
        return this;
      },
      // register listeners
      onLoadMore(callback) {
        if (typeof callback === "function") loadMoreCallback = callback;
        return this;
      },
      onMouseOver(callback) {
        if (typeof callback === "function") mouseOverCallback = callback;
        return this;
      },
      onMouseLeave(callback) {
        if (typeof callback === "function") mouseLeaveCallback = callback;
        return this;
      },
      // clear the list
      clear() {
        listData = [];
        firstIndex = 0;
        lastIndex = 0;
        paddingTop = 0;
        listWrapper.style.paddingTop = paddingTop + "px";
        listWrapper.innerHTML = "";
        listBody.scrollTop = 0;
        return this;
      },
    };
  }

  /**
   * request list's data
   * @param start
   * @param geometry
   * @returns {Promise<*>}
   */
  async function request(start = 0, geometry) {
    const query = {
      start,
      num: 10,
      outFields: ["*"],
      geometry,
    };
    return (await citiesLayer.queryFeatures(query)).features.map((v) => [
      v.attributes.objectid,
      v.attributes.areaname,
      v.attributes.class,
      v.attributes.st,
      v.attributes.capital,
      v.attributes.pop2000,
    ]);
  }

  let highlightSelect;
  // Initialize the list component
  const listComponent = createListComponent(
    document.querySelector("#viewList")
  );
  listComponent
    .onLoadMore(async (lastIndex) =>
      listComponent.addMany(await request(lastIndex + 1, view.extent))
    )
    .onMouseOver((data) => {
      // highlight when hovering the item
      view.whenLayerView(citiesLayer).then((layerView) => {
        if (highlightSelect) {
          highlightSelect.remove();
        }
        const objectid = data[0];
        // set the highlight on the first feature returned by the query
        highlightSelect = layerView.highlight(objectid);
      });
    })
    .onMouseLeave(() => {
      // deselect when leaving the dom element
      view.whenLayerView(citiesLayer).then((layerView) => {
        if (highlightSelect) {
          highlightSelect.remove();
        }
      });
    });
});
