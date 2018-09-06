let Model = {
	currentGeoCoords: [],
	currentAddress: '',
	generalReviewData: [],

	createMap(container, centerCoords, zoomRate) {
		return new ymaps.Map(container, {
			center: centerCoords,
			zoom: zoomRate,
			controls: ['zoomControl']
		});
	},
	createClusterer() {
		return new ymaps.Clusterer({
			groupByCoordinates: false,
			clusterOpenBalloonOnClick: true,
			clusterDisableClickZoom: true,
			clusterBalloonContentLayout: 'cluster#balloonCarousel',
			clusterBalloonItemContentLayout: View.setClustererContentLayout(),
			clusterBalloonPanelMaxMapArea: 0,
			clusterBalloonContentLayoutWidth: 300,
      clusterBalloonContentLayoutHeight: 200,
			hideIconOnBalloonOpen: false,
			clusterIconColor: '#CD5C5C'
		})
	},
	coordsToAddress(coords) {
		Model.currentGeoCoords = coords;

		return new Promise( resolve => {
			let result = ymaps.geocode(coords);
			resolve(result);
		}).then( result => {
			Model.currentAddress = result.geoObjects.get(0).properties.get('text');
			return Model.currentAddress;
		});
	},
	publishReview() {
		let fieldsList = document.querySelector('#reviewForm').elements,
				emptyFieldList = Array.prototype.filter.call(fieldsList, item => {
					return !item.value.trim().length;
				});

		return new Promise( (resolve, reject) => {
			if(!emptyFieldList.length) {
				let presentTime = new Date().toLocaleDateString("ru", {
					hour: 'numeric',
					minute: 'numeric',
					second: 'numeric'
				});
				let reviewData = {
					geoObjectCoords: Model.currentGeoCoords,
					geoObjectAddress: Model.currentAddress,
					reviewDetails: {
						publishedOn: presentTime,
						name: fieldsList[0].value,
						place: fieldsList[1].value,
						reviewText: fieldsList[2].value
					}
				}

				Model.generalReviewData.push(reviewData);

				let geoObject = new ymaps.Placemark(Model.currentGeoCoords, {
					place: reviewData.reviewDetails.place,
					coords: reviewData.geoObjectCoords,
					address: reviewData.geoObjectAddress,
					reviewText: reviewData.reviewDetails.reviewText,
					publishedOn: reviewData.reviewDetails.publishedOn
				}, {
					iconColor: '#CD5C5C'
				});

				geoObject.events.add('click', e => {
					Model.clusterer.balloon.close();
					let clickCoords = e.get('pagePixels');
					Model.currentGeoCoords = e.get('target').properties.get('coords');
					Model.currentAddress = e.get('target').properties.get('address');

					Router.handle('openReviewWindow', {
						clickCoords: clickCoords,
						address: Model.currentAddress,
						publishedReviews: Model.returnReviewsForThisMark(Model.currentGeoCoords)
					});
				});

				Model.clusterer.add(geoObject);

				resolve(reviewData.reviewDetails);	
			} else {
				reject(emptyFieldList);
			}
		});
	},
	returnReviewsForThisMark(coords) {
		thisMarkReviews = Model.generalReviewData.filter( item => {
			return item.geoObjectCoords[0] === coords[0] &&
			 	 		 item.geoObjectCoords[1] === coords[1];
		}),
		reviewsArray = [];
		for(let review of thisMarkReviews) {
			reviewsArray.push(review.reviewDetails);
		}
		return reviewsArray;
	},
	getDataForObject(clickCoords, geoCoords) {
		Model.coordsToAddress(geoCoords).then( address => {
			Router.handle('openReviewWindow', {
				clickCoords: clickCoords,
				address: address,
				publishedReviews: Model.returnReviewsForThisMark(geoCoords)
			});
		});
	}
};
let View = {
	render(templateName, model) {
		templateName = `${templateName}Template`

		let templateElement = document.getElementById(templateName),
				templateSource = templateElement.innerHTML,
				renderFn = Handlebars.compile(templateSource);

		return renderFn(model);
	},
	show(elemId, coords) {
		let elem = document.getElementById(elemId);
		elem.style.left = coords[0] + 'px';
		elem.style.top = coords[1] + 'px';
		let rect = elem.getBoundingClientRect();
		if(rect.right >= document.documentElement.clientWidth ||
			 rect.bottom >= document.documentElement.clientHeight) {
			elem.style.left = '50%';
			elem.style.top = '50%';
			Model.map.panTo(Model.currentGeoCoords)
		} 
		elem.classList.add('review-window__wrapper_show');
	},
	close(elemId) {
		let elem = document.getElementById(elemId);
		elem.classList.remove('review-window__wrapper_show');
	},
	markEmptyFields(emptyFieldList) {
		emptyFieldList.forEach( item => {
			item.classList.add('review-form__element_error')
		})
	},
	removeMarking(field) {
		if(field.classList.contains('review-form__element_error')) {
			field.classList.remove('review-form__element_error');
		}
	},
	setClustererContentLayout() {
		return ymaps.templateLayoutFactory.createClass(
			`<div class=ballon_wrapper>
				<h3 class=ballon_header>{{ properties.place|raw }}</h3>
      	<div class=ballon_body>
      		<a href="#" 
      			 onclick="Router.handle( \'openSelectedObject\', {{ properties.coords }}, event)">
      			 	{{ properties.address|raw }}
      		</a>
      		<p>
      		{{ properties.reviewText|raw }}
      		</p>
      	</div> 
      </div>
      <div class=ballon_footer>{{ properties.publishedOn|raw }}</div>`
		);
	},
}
let Controller = {
	openReviewWindowRoute(extraArgs) {
		let model = extraArgs[0];
		reviewWindow.innerHTML = View.render('reviewWindow', model);
		View.show('reviewWindow', model.clickCoords);
	},
	closeReviewWindowRoute() {
		View.close('reviewWindow');
	},
	addReviewRoute() {
		Model.publishReview().then( reviewData => {
			let reviewListContent = reviewList.innerHTML;
			if(reviewListContent.includes('Отзывов пока нет')) {
				reviewList.innerHTML = '';
			}
			reviewList.innerHTML += View.render('publishReview', reviewData);
			reviewForm.reset();
		},
		emptyFieldList => {
			View.markEmptyFields(emptyFieldList);
		});
	},
	removeErrorClassRoute(extraArgs) {
		View.removeMarking(extraArgs[0]);
	},
	openSelectedObjectRoute(extraArgs) {
		Model.clusterer.balloon.close();
		let event = extraArgs[2];
		event.preventDefault();
		let clickCoords = [event.pageX, event.pageY],
				geoCoords = [extraArgs[0], extraArgs[1]];
		Model.getDataForObject(clickCoords, geoCoords);
	},
};
let Router = {
	handle(route, ...extraArgs) {
		let routeName = `${route}Route`;

		if (!Controller.hasOwnProperty(routeName)) {
      console.error('Маршрут не найден!');
    }

		Controller[routeName](extraArgs);
	}
}
new Promise( resolve => {
	window.onload = resolve;
}).then( () => {
	return new Promise( resolve => {
		ymaps.ready(resolve)
	});
}).then( () => {
	Model.map = Model.createMap('map', [55.75399400, 37.62209300], 12);
	Model.clusterer = Model.createClusterer();
	Model.map.geoObjects.add(Model.clusterer);

	Model.map.events.add('click', e => {
		Model.clusterer.balloon.close();
		let clickCoords = e.get('pagePixels'),
				geoCoords = e.get('coords');

		Model.coordsToAddress(geoCoords).then( address => {
			Router.handle('openReviewWindow', {
				clickCoords: clickCoords,
				address: address,
				noReviewsMessage: 'Отзывов пока нет...' 
			});
		});
				
	});
	Model.clusterer.events.add('balloonopen', () => {
		View.close('reviewWindow')
	})
}).catch( e => {
	console.error(e);
	alert(`Ошибка ${e.message}`);
})