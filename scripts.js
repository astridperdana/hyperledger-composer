/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global getParticipantRegistry getAssetRegistry getFactory */

/**
 * A shipment has been received by an importer
 * @param {org.acme.hospital.health.OrderSelesai} shipmentReceived - the ShipmentReceived transaction
 * @transaction
 */
async function payOut(orderReceived) {  // eslint-disable-line no-unused-vars

    const contract = orderReceived.order.contract;
    const order = orderReceived.order;
    let payOut = order.hargaJasa * order.jumlahUnit;

    console.log('Waktu Pasien Datang : ' + orderReceived.timestamp);
    console.log('Contract Date: ' + contract.tanggal);

    // set the status of the shipment
    order.status = 'SELESAI';

    // find the lowest temperature reading
    if (order.transaksi) {
      	let tempvalue = 0;
    	// sort the temperatureReadings by centigrade
        if(order.type === 'JASADOKTER'){
        	order.transaksi.forEach(function(element, i) {
  				tempvalue += order.transaksi[i].price
			});
          	tempvalue *= order.jumlahUnit;
          	console.log('Jumlah pengecekan sensor organ: ' + tempvalue);
       	} else {
        	order.transaksi.forEach(function(element, i) {
  				tempvalue += (order.transaksi[i].price * order.transaksi[i].value)
			});
          	tempvalue *= order.jumlahUnit;
          	console.log('Jumlah pembelian obat: ' + tempvalue);
        }

        // apply any penalities
        payOut += tempvalue;

        if (payOut < 0) {
            payOut = 0;
        }
    }

    console.log('Payout: ' + payOut);
  
  	if(order.type === 'JASADOKTER') {
    	contract.dokter.accountBalance += payOut;
      	console.log('Dokter: ' + contract.dokter.$identifier + ' new balance: ' + contract.dokter.accountBalance);
      	// update balance
      	const dokterRegistry = await getParticipantRegistry('org.acme.hospital.health.Dokter');
    	await dokterRegistry.update(contract.dokter);
    } else {
    	contract.apotek.accountBalance += payOut;
      	console.log('Apotek: ' + contract.apotek.$identifier + ' new balance: ' + contract.apotek.accountBalance);
      	// update balance
      	const apotekRegistry = await getParticipantRegistry('org.acme.hospital.health.Apotek');
    	await apotekRegistry.update(contract.apotek);
    }
    
    contract.pasien.accountBalance -= payOut;  
    console.log('Pasien: ' + contract.pasien.$identifier + ' new balance: ' + contract.pasien.accountBalance);
	//update balance
  	const pasienRegistry = await getParticipantRegistry('org.acme.hospital.health.Pasien');
    await pasienRegistry.update(contract.pasien);
    // update the state of the order
    const orderRegistry = await getAssetRegistry('org.acme.hospital.health.Order');
    await orderRegistry.update(order);

    
}

/**
 * A temperature reading has been received for a shipment
 * @param {org.acme.hospital.health.Transaksi} temperatureReading - the TemperatureReading transaction
 * @transaction
 */
async function transaksi(transaksi) {  // eslint-disable-line no-unused-vars

    const order = transaksi.order;

    if (order.type === 'JASADOKTER'){
        transaksi.catagory = 'SENSOR';
        console.log('Menambahkan data pengecekan sensor : '+ transaksi.namaUnit +', sebesar : ' + transaksi.value + ', dengan harga : '+transaksi.price +', untuk order ' + order.$identifier);
    } else {
        transaksi.catagory = 'OBAT';
        console.log('Menambahkan data obat : '+ transaksi.namaUnit +', sebesar : ' + transaksi.value + ', dengan harga : '+transaksi.price +', untuk order ' + order.$identifier);       
    }

    if (order.transaksi) {
        order.transaksi.push(transaksi);
    } else {
        order.transaksi = [transaksi];
    }

    // add the temp reading to the shipment
    const orderRegistry = await getAssetRegistry('org.acme.hospital.health.Order');
    await orderRegistry.update(order);
}

/**
 * Initialize some test assets and participants useful for running a demo.
 * @param {org.acme.hospital.health.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
async function setupDemo(setupDemo) {  // eslint-disable-line no-unused-vars

    const factory = getFactory();
    const NS = 'org.acme.hospital.health';

    // create the grower
    const dokter = factory.newResource(NS, 'Dokter', 'dokter@email.com');
    const dokterAddress = factory.newConcept(NS, 'Address');
    dokterAddress.country = 'USA';
    dokter.address = dokterAddress;
    dokter.accountBalance = 0;

    // create the importer
    const pasien = factory.newResource(NS, 'Pasien', 'pasien@email.com');
    const pasienAddress = factory.newConcept(NS, 'Address');
    pasienAddress.country = 'UK';
    pasien.address = pasienAddress;
    pasien.accountBalance = 1500;

    // create the shipper
    const apotek = factory.newResource(NS, 'Apotek', 'apotek@email.com');
    const apotekAddress = factory.newConcept(NS, 'Address');
    apotekAddress.country = 'Panama';
    apotek.address = apotekAddress;
    apotek.accountBalance = 0;

    // create the contract
    const contract = factory.newResource(NS, 'Contract', 'C1');
    contract.dokter = factory.newRelationship(NS, 'Dokter', 'dokter@email.com');
    contract.pasien = factory.newRelationship(NS, 'Pasien', 'pasien@email.com');
    contract.apotek = factory.newRelationship(NS, 'Apotek', 'apotek@email.com');
    const date = setupDemo.timestamp;
    date.setDate(date.getDate());
    contract.tanggal = date; // the shipment has to arrive tomorrow
    
    // create the order
    const order = factory.newResource(NS, 'Order', 'R1');
    order.type = 'JASADOKTER';
    order.status = 'BARU';
    order.jumlahUnit = 1; 
    order.hargaJasa = 20000; // pay 50 cents per unit
    order.contract = factory.newRelationship(NS, 'Contract', 'C1');

  	// create another order
  	const order2 = factory.newResource(NS, 'Order', 'R2');
    order2.type = 'OBAT';
    order2.status = 'BARU';
    order2.jumlahUnit = 1; 
    order2.hargaJasa = 200; // pay 50 cents per unit
    order2.contract = factory.newRelationship(NS, 'Contract', 'C1');

    // add the growers
    const dokterRegistry = await getParticipantRegistry(NS + '.Dokter');
    await dokterRegistry.addAll([dokter]);

    // add the importers
    const pasienRegistry = await getParticipantRegistry(NS + '.Pasien');
    await pasienRegistry.addAll([pasien]);

    // add the shippers
    const apotekRegistry = await getParticipantRegistry(NS + '.Apotek');
    await apotekRegistry.addAll([apotek]);

    // add the contracts
    const contractRegistry = await getAssetRegistry(NS + '.Contract');
    await contractRegistry.addAll([contract]);

    // add the order
    const orderRegistry = await getAssetRegistry(NS + '.Order');
    await orderRegistry.addAll([order]);
  	
  
  	// add another order
  	const orderRegistry2 = await getAssetRegistry(NS + '.Order');
    await orderRegistry2.addAll([order2]);
  
 	console.log('data telah ditambahkan!');
}