import {classNames, select, settings, templates} from '../settings.js';
import utils from '../utils.js';
import AmountWidget from './AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';



class Booking{
  constructor(element){
    const thisBooking = this;

    thisBooking.render(element);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.initTables();

  }

  getData (){
    const thisBooking = this;

    const startDateParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePickerElem.minDate);
    const endDateParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePickerElem.maxDate);

    const params = {
      booking: [
        startDateParam,
        endDateParam,

      ],
      eventCurrent: [
        settings.db.notRepeatParam,
        startDateParam,
        endDateParam,

      ],
      eventRepeat: [
        settings.db.repeatParam,
        endDateParam,

      ],
    };
    console.log('getData params: ', params);

    const urls = {
      booking:       settings.db.url + '/' + settings.db.bookings 
                                     + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.events   
                                     + '?' + params.eventCurrent.join('&'),
      eventsRepeat:  settings.db.url + '/' + settings.db.events   
                                     + '?' + params.eventRepeat.join('&'),
    };

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),

    ])
      .then(function(allResponses){
        const bookingsResponse = allResponses[0];
        const eventsCurrentResponse = allResponses[1];
        const eventsRepeatResponse = allResponses[2];

        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),

        ]);
      }) 
      .then(function([bookings, eventsCurrent, eventsRepeat ]){  
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat){
    const thisBooking = this;

    thisBooking.booked = {};

    for(let item of bookings){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }    
    
    for(let item of eventsCurrent){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePickerElem.minDate;
    const maxDate = thisBooking.datePickerElem.maxDate;

    for(let item of eventsRepeat){
      if(item.repeat == 'daily'){
        for(let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }
    }
    thisBooking.updateDOM();
  }


  makeBooked(date, hour, duration, table){
    const thisBooking = this;

    if(typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }    

    const startHour = utils.hourToNumber(hour);    

    for(let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){     

      if(typeof thisBooking.booked[date][hourBlock] == 'undefined'){
        thisBooking.booked[date][hourBlock] = [];
      }  
      thisBooking.booked[date][hourBlock].push(table);
    } 
  }

  updateDOM(){
    const thisBooking = this;

    thisBooking.date = thisBooking.datePickerElem.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPickerElem.value);

    let allAvailable = false;

    if(
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ){
      allAvailable = true;
    }

    for(let table of thisBooking.dom.table){
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if(!isNaN(tableId)){
        tableId = parseInt(tableId);
      }

      if(
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId) >= 1
      ){
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  initTables(){
    const thisBooking = this;

    thisBooking.dom.roomPlan.addEventListener('click', function(event){     

      const clickedElement = event.target;
      console.log(clickedElement);
      const getTableId = clickedElement.getAttribute(settings.booking.tableIdAttribute);
      console.log(getTableId);
      let tableId = '';
      
      if(getTableId != null){
        
        if(!clickedElement.classList.contains(classNames.booking.tableBooked)){
         
          const tables = thisBooking.element.querySelectorAll(select.booking.tables);
         
          if(!clickedElement.classList.contains(classNames.booking.tableSelected)){
            for(let table of tables ){
              table.classList.remove(classNames.booking.tableSelected);
              tableId = '';
            }
            clickedElement.classList.add(classNames.booking.tableSelected);

            const clickedElementId = clickedElement.getAttribute('data-table');
            tableId = clickedElementId;
            thisBooking.tableId = parseInt(tableId);
            
          } else if (clickedElement.classList.contains(classNames.booking.tableSelected)){
            clickedElement.classList.remove(classNames.booking.tableSelected);
          } 
        }
      }
    });
  }


  render(element){
    const thisBooking = this;

    const generatedHTML = templates.bookingWidget();
    thisBooking.element = utils.createDOMFromHTML(generatedHTML);

    const bookingContainer = document.querySelector(select.containerOf.booking);
    bookingContainer.appendChild(thisBooking.element);

    thisBooking.dom = {
      wrapper: element, 
      hoursAmount: element.querySelector(select.booking.hoursAmount),
      peopleAmount: element.querySelector(select.booking.peopleAmount), 
      datePickerInput: element.querySelector(select.widgets.datePicker.wrapper),
      hourPickerInput: element.querySelector(select.widgets.hourPicker.wrapper),    
      table: element.querySelectorAll(select.booking.tables),
      roomPlan: element.querySelector(select.booking.roomPlan),
    };
  }

  initWidgets(){
    const thisBooking = this;

    thisBooking.peopleAmountElem = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmountElem = new AmountWidget(thisBooking.dom.hoursAmount); 
    thisBooking.datePickerElem = new DatePicker(thisBooking.dom.datePickerInput); 
    thisBooking.hourPickerElem = new HourPicker(thisBooking.dom.hourPickerInput);
  
    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.updateDOM();
    });   
    
  }
}


export default Booking;