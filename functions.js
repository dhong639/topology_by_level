function show_reset() {
	document.getElementById('show_segment').innerHTML = ''
	document.getElementById('select_segment').selectedIndex = 0
	document.getElementById('show_domain').innerHTML = ''
	document.getElementById('select_domain').selectedIndex = 0
	remove_options('edge_delTarget')
	document.getElementById('edge_delSource').selectedIndex = 0
	remove_options('edge_addTarget')
	document.getElementById('edge_addSource').selectedIndex = 0

	graph.get_nodes().forEach(node => {
		cy.$('#' + node).data({
			color: graph.root == node ? '#6495ED' : '#98FB98',
			invert: graph.root == node ? '#9B6A12': '#670467',
		})
	})
}

function show_segment() {
	var start = document.getElementById('select_segment').value
	show_reset()
	document.getElementById('show_segment').innerHTML = start
	if(start != '') {
		var segment = graph.get_segment(start)
		segment.forEach(node => {
			cy.$('#' + node).data({
				color: '#DB7093',
				invert: '#248f6c'
			})
		})
	}
}

function show_domain() {
	var domain = document.getElementById('select_domain').value
	show_reset()
	document.getElementById('show_domain').innerHTML = domain
	if(domain != '') {
		graph.domains[domain].forEach(node => {
			cy.$('#' + node).data({
				color: '#DB7093',
				invert: '#248f6c'
			})
		})
	}
}

function show_graph() {
	/*console.log('graph contents')
	console.log(graph.graph)
	console.log('intra-level links')
	console.log(graph.links_intra)
	console.log('child links')
	console.log(graph.links_child)
	console.log('parent links')
	console.log(graph.links_parent)*/
	cy.elements().remove()
	var links_intra = graph.links_intra
	var links_child = graph.links_child
	var set_level = new Set()
	graph.get_nodes().forEach(node => {
		var level = graph.levels[node]
		if(level != null && set_level.has(level) == false) {
			set_level.add(level)
			add_level_cy(level)
		}
		add_node_cy(node, level, graph.root)
	})
	var set_edges = new Set()
	for(var level in links_intra) {
		for(var source in links_intra[level]) {
			links_intra[level][source].forEach(edge_id => {
				/**
				 * unlike inter-level links, intra-level links are recorded twice
				 * directions for intra-level links don't matter
				 * consequently, do not add duplicate links
				 */
				if(set_edges.has(edge_id) == false) {
					add_edge_cy(edge_id, graph.edges[edge_id][0], graph.edges[edge_id][1])
					set_edges.add(edge_id)
				}
			})
		}
	}
	for(var level in links_child) {
		for(var source in links_child[level]) {
			links_child[level][source].forEach(edge_id => {
				add_edge_cy(edge_id, graph.edges[edge_id][0], graph.edges[edge_id][1])
			})
		}
	}
	this.cy.layout({
		name: 'breadthfirst',
		roots: '#' + graph.root
	}).run()
}
function add_level_cy(level_id) {
	cy.add({
		data: {
			id: level_id,
			color: '#DCDCDC',
			invert: '#232323',
			valign: 'top',
			halign: 'center'
		}
	})
}
function add_node_cy(node_id, level, root) {
	cy.add({
		data: {
			id: node_id,
			color: root == node_id ? '#6495ED' : '#98FB98',
			invert: root == node_id ? '#9B6A12': '#670467',
			parent: level,
			valign: 'center',
			halign: 'center'
		}
	})
}
function add_edge_cy(edge_id, source, target) {
	cy.add({
		data: {
			id: edge_id,
			source: source,
			target: target,
			is_up: graph.edges[edge_id][2] ? 'solid' : 'dashed'
		}
	})
}

function add_options(select_id, items) {
	items.forEach(item => {
		var option = document.createElement('option')
		option.text = item
		option.value = item
		document.getElementById(select_id).add(option)
	})
}

function remove_options(select_id, count=1) {
	var select = document.getElementById(select_id)
	while(select.length > count) {
		select.remove(select.length - 1)
	}
}

function update_delTarget() {
	remove_options('edge_delTarget')
	var source = document.getElementById('edge_delSource').value
	var targets = []
	if(source != '') {
		graph.get_nodesIntra(source).forEach(target => {
			targets.push(target)
		})
		graph.get_nodesChild(source).forEach(target => {
			targets.push(target)
		})
	}
	targets.sort()
	add_options('edge_delTarget', targets)
}

function update_addTarget() {
	remove_options('edge_addTarget')
	var source = document.getElementById('edge_addSource').value
	var targets = new Set(graph.get_neighbors(source))
	var nodes = new Set(graph.get_nodes())
	console.log(targets)
	console.log(nodes)
	var difference = []
	if(source != '') {
		nodes.forEach(node => {
			if(targets.has(node) == false && node != source) {
				difference.push(node)
			}
		})
	}
	difference.sort()
	add_options('edge_addTarget', difference)
}

function edge_del() {
	var source = document.getElementById('edge_delSource').value
	var target = document.getElementById('edge_delTarget').value
	if(source != '' && target != '') {
		//graph.remove_edge(source, target)
		graph.remove_edge(source, target)
	}
	show_reset()
	remove_options('select_domain')
	add_options('select_domain', graph.get_domains())
	show_graph()
}

function edge_add() {
	var source = document.getElementById('edge_addSource').value
	var target = document.getElementById('edge_addTarget').value
	var edge_id = document.getElementById('counter_edgeID').value
	if(source != '' && target != '' && edge_id != '') {
		graph.insert_edge(edge_id, source, target)
	}
	set_counterEdge()
	show_reset()
	remove_options('select_domain')
	add_options('select_domain', graph.get_domains())
	show_graph()
}

function reset_graph() {
	console.log('reset')
	console.log(edges)
	graph = new Graph(edges, 'A')
	console.log(graph.edges)
	show_graph()
	show_reset()
}

function set_counterEdge() {
	var element = document.getElementById('counter_edgeID')
	var edges = Object.keys(graph.edges)
	var max = Math.max(...edges) + 1
	element.min = max
	element.value = max
}