import Vlitejs from 'vlitejs';

window.$ = window.jQuery = require('jquery');
import Hls from 'hls.js';
import {throttle} from "lodash";

const videoMethods = {
    xmlData: null,
    sortedTimestamps: [],
    mainEventStartTime: null,
    players: [],
    playerMarkup(attributes, isModal = false) {
        const modalPlayerClass = isModal ? 'video-container--inline' : '';
        return `
                <div class="video-container ${modalPlayerClass}">
                    <div class="marker-event-data">
                        <div class="video-title"></div>
                        <div>
                            
                        </div>
                    </div>
                
                    <div class="player-container">
                        <video src="${attributes.videoSrc}"></video>
                    </div>
                </div>
                <div class="timestamps">
                <ul></ul>
                </div>
                <div class="metadata-container">
                    <button class="metadata-details">
                        <span class="event-count">
                            <span><span class="event-index">1</span> / <span class="total-event-count"></span></span>
                            <span class="event-name"></span>
                        </span>
                        <span class="toggle-icon-container">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="plus-icon">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>           
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="minus-icon">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>

                        </span>
                    </button>
                    <div class="metadata-items"></div>
                </div>
            `
    },
    setInlinePlayersHtml() {
        const players = document.querySelectorAll('.video-player-app');

        players.forEach(async container => {
            const videoSrc = container.getAttribute('data-video-src');
            const xmlSrc = container.getAttribute('data-video-metadata');

            const playerData = {
                videoSrc,
                xmlSrc
            }


            this.players.push(playerData);

            container.innerHTML = this.playerMarkup({
                videoSrc
            });

            await this.getXmlDocument(xmlSrc)
                .then((playerXmlData) => {
                    const playerData = this.players.find(player => {
                        return player.xmlSrc === xmlSrc;
                    });

                    playerData.xmlData = playerXmlData;

                    const videoSrc = playerData.videoSrc;
                    const videoXmlMetadata = this.findXmlByVideoSrc(videoSrc).xmlData
                    const sortedVideoTimestamps = this.getVideoSortedTimestamps(videoXmlMetadata);
                    const mainEventStartTime = this.getMainEventStartTime(videoXmlMetadata) || null;

                    playerData.sortedVideoTimestamps = sortedVideoTimestamps;
                    playerData.mainEventStartTime = mainEventStartTime;


                    setTimeout(() => {
                        this.printVideoPlayerEventCount(videoSrc, videoXmlMetadata);
                        this.printVideoTitle(videoSrc, this.getVideoTitle(this.findXmlByVideoSrc(videoSrc)));
                        this.renderSidebarTimestamps(videoSrc, videoXmlMetadata);
                        this.initPlayer(playerData.videoSrc, mainEventStartTime, sortedVideoTimestamps);

                        this.setDefaultEvent(videoSrc);
                    }, 180);
                });

        });

        this.enableMetadataDetailsDropdowns();
    },
    createModalDialog() {
        const template = `
        <dialog id="overlay-video-player">
            <div class="video-player-app">
            <div class="video-container"></div>
            </div>             
        </dialog>
      `;
        document.body.insertAdjacentHTML('beforeend', template);
        return document.querySelector('#overlay-video-player');
    },
    enableModalVideoPlayers() {
        const modalTriggers = document.querySelectorAll('[data-overlay-video-player-trigger]');

        if (!modalTriggers.length) {
            return;
        }

        const modalDialog = this.createModalDialog();

        [...modalTriggers].forEach(button => {
            button.addEventListener('click', async e => {
                const target = e.target.hasAttribute('data-overlay-video-player-trigger') ? e.target : e.target.closest('[data-overlay-video-player-trigger]');

                const videoSrc = target.getAttribute('data-video-src');
                const videoMetadataUrl = target.getAttribute('data-video-metadata');
                const videoTimestampIndex = target.getAttribute('data-video-timestamp-index');

                const modalDialogContentContainer = modalDialog.querySelector('.video-player-app');

                modalDialogContentContainer.setAttribute('data-video-src', videoSrc);
                modalDialogContentContainer.setAttribute('data-video-metadata', videoMetadataUrl);
                modalDialogContentContainer.setAttribute('data-video-timestamp-index', videoTimestampIndex);

                modalDialogContentContainer.innerHTML = this.playerMarkup({
                    videoSrc
                }, true);


                await this.getXmlDocument(videoMetadataUrl)
                    .then((playerXmlData) => {
                        const playerData = playerXmlData

                        playerData.xmlData = playerXmlData;

                        const sortedVideoTimestamps = this.getVideoSortedTimestamps(playerXmlData);
                        const mainEventStartTime = this.getMainEventStartTime(playerXmlData) || null;

                        playerData.sortedVideoTimestamps = sortedVideoTimestamps;
                        playerData.mainEventStartTime = mainEventStartTime;


                        this.renderSidebarTimestamps(videoSrc, playerXmlData, true).then(() => {
                            this.printVideoPlayerEventCount(videoSrc, playerXmlData, true);
                            this.printVideoTitle(videoSrc, this.getVideoTitle(playerXmlData), true);

                            const player = this.initPlayer(videoSrc, mainEventStartTime, sortedVideoTimestamps, true);
                            this.enableMetadataDetailsDropdowns(true);
                            this.setDefaultEvent(videoSrc, true, videoTimestampIndex);

                            modalDialog.addEventListener('close', e => {
                                player.destroy();
                            });
                        })
                    });

                function enableModalClosebutton() {
                    modalDialogContentContainer.insertAdjacentHTML('afterbegin', `
                        <button id="close-overlay-video-player" title="Close video">
                            <span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </span>
                        </button>
                    `);
                    document.querySelector('#close-overlay-video-player').addEventListener('click', e => modalDialog.close());
                }

                enableModalClosebutton();
                modalDialog.showModal();
            })
        });
    },
    /**
     * @param {boolean} isModalVideo
     */
    enableMetadataDetailsDropdowns(isModalVideo = false) {
        const dropdownToggles = !isModalVideo ? document.querySelectorAll('button.metadata-details') : document.querySelectorAll('#overlay-video-player button.metadata-details');
        $('.metadata-items').hide();

        [...dropdownToggles].forEach(button => {
            button.addEventListener('click', e => {
                const isDropdownClosed = ![...button.classList].includes('open');
                const container = button.nextElementSibling

                if (isDropdownClosed) {
                    $(container).slideDown();
                    button.classList.add('open');
                    return;
                }
                $(container).slideUp();
                button.classList.remove('open');
            })
        });
    },
    /**
     * @param xmlSrc
     * @returns {Promise<XMLDocument>}
     */
    async getXmlDocument(xmlSrc) {
        const response = await fetch(xmlSrc)
        const xmlText = await response.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        return xmlDoc;
    },
    findXmlByVideoSrc(videoSrc) {
        return this.players.find(player => player.videoSrc === videoSrc);
    },
    /**
     * @param {XMLDocument} playerXmlData
     * @returns {*}
     */
    getMainEventStartTime(playerXmlData) {
        const mainEventStartTime = playerXmlData
            .querySelector('CATEGORIES CATEGORY[name="Actual start time"]')
            .textContent
        return mainEventStartTime;
    },
    getEventCategories(item) {
        return item.querySelectorAll('CATEGORY');
    },
    /**
     * @param {XMLDocument} videoXml
     * @returns {*}
     */
    getVideoTitle(videoXml) {
        const videoTitle = videoXml.xmlData.querySelector('NAME').textContent;
        return videoTitle;
    },
    /**
     * @param {XMLDocument} videoXmlData
     * @returns {*[]}
     */
    getVideoSortedTimestamps(videoXmlData) {
        return [...videoXmlData.querySelectorAll('LIBRARY_ITEM[ItemType="Marker.Event"]')]
            .sort((itemA, itemB) => {
                const inAttributeA = +itemA.getAttribute('IN');
                const inAttributeB = +itemB.getAttribute('IN');

                if (inAttributeA > inAttributeB) {
                    return 1;
                }
                return -1;
            })
            .map((item, index) => {
                item.setAttribute('eventIndex', index + 1);

                const eventCategories = this.getEventCategories(item);

                const eventTime = [...eventCategories].find(category => {
                    return category.getAttribute('name') === 'Event Time';
                }).textContent;

                item.setAttribute('eventTime', eventTime);
                return item;
            });
    },
    /**
     * @param {string} videoSrc
     * @param {XMLDocument} videoXmlData
     * @param {boolean} isModalVideo
     */
    async renderSidebarTimestamps(videoSrc, videoXmlData, isModalVideo = false) {
        const videoContainer = await this.getVideoContainerBySrc(videoSrc, isModalVideo);
        const xmlSource = videoXmlData;

        const destination = videoContainer.querySelector('.timestamps > ul');
        const timestamps = this.getVideoSortedTimestamps(videoXmlData);

        timestamps.forEach(item => {
            destination.insertAdjacentHTML('beforeend', this.getSidebarTimestampHtml(item, this.getMainEventStartTime(videoXmlData)));
        });
    },
    /**
     * @param {number} mainEventStartTimestamp
     * @param {number} eventTimestamp
     * @returns {number}
     */
    getTimestampOffset(mainEventStartTimestamp, eventTimestamp) {
        const timestamp1 = new Date(eventTimestamp);
        const timestamp2 = new Date(mainEventStartTimestamp);

        const differenceInMilliseconds = Math.abs(timestamp1 - timestamp2);
        return Math.floor(differenceInMilliseconds / 1000);
    },
    /**
     * @param {number} timestamp
     * @param videoPlayerInstance
     */
    seekTimestampInVideo(timestamp, videoPlayerInstance) {
        try {
            videoPlayerInstance.seekTo(timestamp);
            videoPlayerInstance.play();
        } catch (error) {
            console.error('Playback error', error);
        }
    },
    /**
     * @param {number} systemTimestamp
     * @returns {string}
     */
    formatPrintableTimestamp(systemTimestamp) {
        const minutes = Math.floor(systemTimestamp / 60);
        const seconds = Math.floor(systemTimestamp % 60);

        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },
    /**
     * @param videoUrl
     * @param {number} mainEventStartTime
     * @param {array} sortedVideoTimestamps
     * @param player
     * @param isModalVideo
     */
    async addSidebarTimestampsEventListeners(videoUrl, mainEventStartTime, sortedVideoTimestamps, player, isModalVideo = false) {
        const container = await this.getVideoContainerBySrc(videoUrl, isModalVideo);
        const timestamps = container.querySelectorAll('.timestamps li');
        const eventNameElement = container.querySelector('.event-name');
        const eventIndexElement = container.querySelector('.event-index');

        [...timestamps].forEach(item => {
            item.addEventListener('click', e => {
                const target = e.target.hasAttribute('data-event-index') ? e.target : e.target.closest('li');

                if (!target) {
                    console.warn('Target not found:', e.target);
                }

                const eventTitle = target.getAttribute('data-event-name');
                const eventIndex = target.getAttribute('data-event-index');
                const playlistParent = target.closest('ul');

                eventNameElement.textContent = eventTitle;
                eventIndexElement.textContent = eventIndex;

                const clickedItemData = sortedVideoTimestamps[eventIndex - 1];

                if (!clickedItemData) {
                    console.warn(`Unable to find timestamp data for clicked item:`, e.target);
                    return;
                }

                playlistParent.setAttribute('data-active-item-index', eventIndex);
                playlistParent.querySelectorAll('li').forEach(item => item.classList.remove('active'));

                const activeItem = playlistParent.querySelector(`[data-event-index="${eventIndex}"]`);
                activeItem.classList.add('active');

                this.seekTimestampInVideo(this.getTimestampOffset(mainEventStartTime, clickedItemData.getAttribute('eventTime')), player);
                const eventCategories = this.getEventCategories(clickedItemData);
                container.querySelector('.metadata-items').innerHTML = this.categoriesMetadataHtml(eventCategories);
            })
        })
    },
    /**
     * @param videoSrc
     * @param isModalVideo
     * @returns {Promise<Element>}
     */
    async getVideoContainerBySrc(videoSrc, isModalVideo = false) {
        if (isModalVideo) {
            return document.querySelector(`#overlay-video-player .video-player-app[data-video-src="${videoSrc}"]`);
        }
        return document.querySelector(`.video-player-app[data-video-src="${videoSrc}"]`);
    },
    /**
     * @param {string} videoSrc
     * @param videoXmlMetadata
     * @param {boolean} isModalVideo
     */
    printVideoPlayerEventCount(videoSrc, videoXmlMetadata, isModalVideo = false) {
        this.getVideoContainerBySrc(videoSrc, isModalVideo)
            .then(container => {
                container.querySelector('.total-event-count').textContent = this.getVideoSortedTimestamps(videoXmlMetadata).length;
            });
    },
    /**
     * @param {string} videoSrc
     * @param {boolean} isModalVideo
     */
    printVideoTitle(videoSrc, videoTitle, isModalVideo = false) {
        this.getVideoContainerBySrc(videoSrc, isModalVideo)
            .then(container => {
                container.querySelector('.video-title').textContent = videoTitle;
            });
    },
    /**
     * @param {string} videoSrc
     * @param {boolean} isModalVideo
     * @param defaultTimestampIndex
     */
    async setDefaultEvent(videoSrc, isModalVideo = false, defaultTimestampIndex = 0) {
        const container = await this.getVideoContainerBySrc(videoSrc, isModalVideo);
        const defaultItem = container.querySelectorAll(`[data-event-name]`)[defaultTimestampIndex];

        if (defaultItem) {
            setTimeout(() => {
                defaultItem.click();
            }, 180);
        }
    },
    /**
     *
     * @param {object} item
     * @param {number} mainEventStartTimestamp
     * @returns {string}
     */
    getSidebarTimestampHtml(item, mainEventStartTimestamp) {
        const title = item.querySelector('Property[Name="Title"]').textContent;
        const eventTimestamp = item.getAttribute('eventTime');
        const timeOffset = this.getTimestampOffset(mainEventStartTimestamp, eventTimestamp);
        const printableTimeOffset = this.formatPrintableTimestamp(timeOffset);

        return `
                <li data-event-name="${title}" data-event-index="${item.getAttribute('eventIndex')}" data-event-time="${eventTimestamp}"><span>${printableTimeOffset}</span> - <span>${title}</span></li>
            `
    },
    getEventCategoriesValues(eventCategories, key) {
        return [...eventCategories].filter(category => category.getAttribute('name') === key)
            .map(item => item.textContent);
    },
    eventCategoriesExcept(categories, keyNames) {
        return [...categories]
            .filter(category => {
                return !keyNames.includes(category.getAttribute('name'));
            });
    },
    categoriesMetadataHtml(categories) {
        const runners = this.getEventCategoriesValues(categories, 'Runner Name');
        const printableCategories = this.eventCategoriesExcept(categories, ['Runner Name', 'Race Name']);
        const boxesHtml = `
                ${[...printableCategories]
            //Reject items that have underscore in attribute name, e.g. sk_race_id
            .filter(category => {
                return !category.getAttribute('name').includes('_') && category.textContent.trim().length > 0;
            })
            .map(category => {
                return `<div>
                        <div>${category.getAttribute('name')}</div>
                        <div>${category.textContent}</div>
                    </div>`
            })
            .join('')
        }
            `
        return `
        <h5 class="race-name">Race: ${this.getEventCategoriesValues(categories, 'Race Name')[0]}</h5>
        <div>
            ${boxesHtml}
        </div>
        <h5>Runners</h5>
            <div>
                ${runners.map(runner => `<div>${runner}</div>`).join('')}
            </div>
        `;
    },
    updateProgress: throttle(async (e, player, mainEventStartTime) => {
        const videoContainer = e.target;
        const timestampSidebarItems = [...videoContainer.closest('.video-player-app').querySelectorAll('.timestamps ul > li')];
        const timestampsFromSidebarItems = timestampSidebarItems.map(item => new Date(item.getAttribute('data-event-time')));
        const eventIndexElement = videoContainer.closest('.video-player-app').querySelector('.event-index');
        const playerEventTitleElement = videoContainer.closest('.video-player-app').querySelector('.event-name');

        await player.getCurrentTime()
            .then(value => {
                const currentTime = Math.floor(value);
                const originalTimestamp = new Date(mainEventStartTime);
                const currentTimestampDate = new Date(originalTimestamp.setSeconds(originalTimestamp.getSeconds() + currentTime));
                const formattedCurrentTimestamp = new Date(currentTimestampDate.toISOString().slice(0, -1));

                const currentSidebarItemIndex = timestampsFromSidebarItems.findIndex((item) => {
                    const formattedCurrentTimestampToDate = new Date(formattedCurrentTimestamp);
                    return item > currentTimestampDate
                });

                const currentSidebarItem = timestampSidebarItems[currentSidebarItemIndex - 1];
                const currentEventTitle = currentSidebarItem.textContent;
                timestampSidebarItems.forEach(item => item.classList.remove('active'));
                currentSidebarItem.classList.add('active');
                eventIndexElement.textContent = currentSidebarItemIndex;
                playerEventTitleElement.textContent = currentEventTitle;
            });
    }, 30),
    /**
     * @param videoUrl
     * @param mainEventStartTime
     * @param sortedVideoTimestamps
     * @param isModalVideo
     */
    initPlayer(videoUrl, mainEventStartTime, sortedVideoTimestamps, isModalVideo = false) {
        const video = !isModalVideo ? document.querySelector(`video[src="${videoUrl}"]`) : document.querySelector(`#overlay-video-player video[src="${videoUrl}"]`);

        const player = new Vlitejs(video, {
            onReady: async (player) => {
                this.addSidebarTimestampsEventListeners(videoUrl, mainEventStartTime, sortedVideoTimestamps, player, isModalVideo);

                player.on('timeupdate', e => this.updateProgress(e, player, mainEventStartTime))
            }
        });

        if (!(Hls.isSupported()) || videoUrl.endsWith('.mp4')) {
            video.src = videoUrl
        } else {
            const hls = new Hls()
            hls.loadSource(videoUrl)
            hls.attachMedia(video)
        }
        return player
    },
    init: function () {
        this.setInlinePlayersHtml();
        this.enableModalVideoPlayers();
    }
}

videoMethods.init();